// Chris (6 Nov, points 5, 6 and 7), checked in the real editor at 1280 and 390 against the mocked API.
//  5. Duplicate in the selected section's action bar (↑ ↓ ⧉ 🗑 | ✕): every section type is copied right below itself
//     (same data, new id) and the copy is selected; never on the Message section; a full email shows the limit message.
//  6. Image sections are full-bleed: the picture's box is the section's box (no padding), selected or not, nothing over
//     the picture (no tint, no frame), at 1280 and 390.
//  7. Button: "Full width" and "Open in new window" ticks. A new button opens in a new window; an older one has neither
//     ticked; full width spans the content; the saved keys are exactly full_width / new_window, only when on.
// NLB_PAYLOAD=<file>: the final saved blocks are written there (to render the real email from them, nlb-render.php).
// NLB_EMAIL=<file>: the real email the API rendered from them, shown in "Preview exact email" and measured.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createMockApi, newsletter, STUDIO } from '../mock-api.mjs';

const OUT = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
const PHOTO = 'https://127.0.0.1/nlb/collage.svg';
// Three photos side by side, like Chris's picture (no frame of its own: whatever shows around it is the editor's).
const COLLAGE = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
<rect width="400" height="600" fill="#1d3557"/><circle cx="200" cy="280" r="150" fill="none" stroke="#f6e7d8" stroke-width="40"/>
<rect x="400" width="400" height="600" fill="#a68a7b"/><rect x="540" y="180" width="120" height="260" rx="30" fill="#2b2b2b"/>
<rect x="800" width="400" height="600" fill="#14213d"/><circle cx="1000" cy="300" r="160" fill="none" stroke="#fce5cd" stroke-width="40"/></svg>`;
const MESSAGE = 'nl-message';
const card = (id, title) => ({ kind: 'campaign', id, title, description: `About ${title}.`, cover_url: PHOTO, url: `${STUDIO}/published-memory/campaign-${id}`, date: '2026-10-20', price_text: null, meta: null });

const EVERY = () => [
  { id: MESSAGE, type: 'text', data: { html: '<p>Hello from Serpa</p>' } },
  { id: 'bt1', type: 'title', data: { text: 'INNOVATE. INSPIRE. IMPACT', size: 'large', align: 'center', background_color: '#FEF3C7' } },
  { id: 'bx1', type: 'text', data: { html: '<p>Leadership in a <strong>new era</strong>.</p>' } },
  { id: 'bi1', type: 'image', data: { url: PHOTO, alt: 'Ring lights', link: 'https://serpachrysler.ca/event' } },
  { id: 'bu1', type: 'button', data: { label: 'RSVP', url: 'https://serpachrysler.ca/rsvp', color: '#4F6752' } },
  { id: 'bd1', type: 'divider', data: { style: 'line' } },
  { id: 'by1', type: 'youtube', data: { url: 'https://youtu.be/dQw4w9WgXcQ' } },
  { id: 'bc1', type: 'campaigns', data: { selections: [{ kind: 'campaign', id: 601 }], campaign_ids: [601], columns: 2, items: [card(601, 'Fall service event')],
    overrides: { 'campaign:601': { title: 'Our fall event', button_text: 'Come along' } } } },
];
const LABEL = { title: 'Title', text: 'Text', image: 'Image', button: 'Button', divider: 'Divider', youtube: 'YouTube', campaigns: 'Campaigns' };

async function serve(page) {
  await page.route('https://127.0.0.1/nlb/**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: COLLAGE }));
}

async function partShot(locator, file) {
  const path = `${OUT}/section-actions-${file}.png`;
  await locator.screenshot({ path });
  console.log('shot', path);
}

function savedBlocks(api) {
  const puts = api.state.calls.filter((c) => c.method === 'PUT' && /^\/newsletters\/\d+$/.test(c.path) && c.body && 'blocks' in c.body);
  return puts.length ? puts[puts.length - 1].body.blocks : null;
}

async function inViewport(page, locator) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize();
  return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 0.5 && box.y + box.height <= vp.height + 0.5;
}

const close = (a, b, d = 0.6) => Math.abs(a - b) <= d;

/** The picture fills its section exactly, and nothing covers it (no tint, overlay or frame drawn over it). */
async function imageFillsSection(page, frame) {
  const img = frame.locator('img[data-nl-image]');
  const [ib, fb] = [await img.boundingBox(), await frame.boundingBox()];
  const cover = await img.evaluate((el) => {
    const r = el.getBoundingClientRect();
    // Not the top right corner: the selected section's action bar sits there, over every section's edge.
    const points = [[0.5, 0.5], [0.1, 0.3], [0.9, 0.7], [0.3, 0.9], [0.2, 0.12]];
    const hits = points.map(([x, y]) => document.elementFromPoint(r.left + r.width * x, r.top + r.height * y) === el);
    let tinted = false;
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (parseFloat(s.opacity) < 1 || s.filter !== 'none' || s.mixBlendMode !== 'normal') tinted = true;
    }
    const s = getComputedStyle(el);
    return { hits, tinted, radius: s.borderTopLeftRadius, padding: s.padding, nat: el.naturalWidth > 0 };
  });
  return {
    ok: !!ib && !!fb && close(ib.x, fb.x) && close(ib.width, fb.width) && close(ib.y, fb.y) && cover.hits.every(Boolean) && !cover.tinted && cover.radius === '0px' && cover.nat,
    detail: JSON.stringify({ ib, fb, ...cover }),
  };
}

/** How much two same-size screenshots differ: the share of pixels with a channel off by more than 24 (anti-aliasing and
 *  sub-pixel placement move a few pixels by a little; a selection highlight tints every pixel by a lot). */
async function pixelDiff(page, a, b) {
  return page.evaluate(async ([x, y]) => {
    const load = (src) => new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(x), load(y)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return 1;
    const read = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const [da, db] = [read(ia), read(ib)];
    let off = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) > 24) off += 1;
    return off / (da.length / 4);
  }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`]);
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const width of [1280, 390]) {
    const api = createMockApi({ newsletters: [newsletter(71, { name: 'Chris 6 Nov', subject: 'The event', from_name: 'Serpa Chrysler', sms_text: 'Hello from Serpa', blocks: EVERY() })] });
    const { page, context } = await open({ width, height: width === 390 ? 844 : 1100, api, query: '&newsletterId=71' });
    await serve(page);
    const preview = page.locator('aside');
    const frameOf = (id) => preview.locator(`[data-block-id="${id}"]`);
    const order = () => preview.locator('[data-block-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-block-id')));
    const until = async (check, label) => {
      for (let i = 0; i < 50; i += 1) {
        const b = savedBlocks(api);
        if (b && check(b)) return b;
        await page.waitForTimeout(150);
      }
      expect(false, `${width}: saved: ${label} (got ${JSON.stringify(savedBlocks(api))?.slice(0, 400)})`);
      return savedBlocks(api) ?? [];
    };
    await expectVisible(frameOf('bi1'), `${width}: draft opened`);
    // The picture may have been asked for before serve() was in place: load it again.
    await page.locator('aside img[data-nl-image]').evaluateAll((els) => els.forEach((el) => { if (!el.naturalWidth) el.src = `${el.src.split('?')[0]}?r=1`; }));
    await page.waitForFunction(() => [...document.querySelectorAll('aside img[data-nl-image]')].every((el) => el.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);

    // ---- 6. the image section, unselected: edge to edge, nothing over it -------------------------------------------
    const image = frameOf('bi1');
    await image.scrollIntoViewIfNeeded();
    let fill = await imageFillsSection(page, image);
    expect(fill.ok, `${width}: unselected picture fills its section, nothing over it (${fill.detail})`);
    // The section is the card's full width (inside its 1 px border).
    const cardBox = await preview.locator('div.max-w-\\[600px\\]').first().boundingBox();
    const imgBox = await image.boundingBox();
    expect(cardBox && imgBox && close(imgBox.x, cardBox.x + 1, 1) && close(imgBox.width, cardBox.width - 2, 1), `${width}: the picture spans the card edge to edge (${JSON.stringify({ cardBox, imgBox })})`);
    await partShot(image, `${width}-01-image-unselected`);

    // Review (6 Nov): Chris's lavender frame and blue cast were the browser's text-selection highlight painted over the
    // picture (Cmd+A, or a drag across sections). A selection over the whole canvas now leaves the picture untouched.
    await page.mouse.move(2, 2);
    await page.waitForTimeout(200);
    const props = await image.locator('img[data-nl-image]').evaluate((el) => ({ select: getComputedStyle(el).userSelect, drag: el.getAttribute('draggable') }));
    expect(props.select === 'none' && props.drag === 'false', `${width}: the picture can't be selected or dragged (${JSON.stringify(props)})`);
    const text = frameOf('bx1');
    const [imgBefore, textBefore] = [await image.screenshot(), await text.screenshot()];
    const picked = await page.evaluate(() => {
      const root = document.querySelector('aside [data-block-id="nl-message"]').parentElement;
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.selectAllChildren(root);
      return sel.toString().length;
    });
    await page.waitForTimeout(200);
    const [imgAfter, textAfter] = [await image.screenshot(), await text.screenshot()];
    expect(picked > 20, `${width}: the whole canvas is selected (${picked} characters)`);
    const [textDiff, imgDiff] = [await pixelDiff(page, textBefore, textAfter), await pixelDiff(page, imgBefore, imgAfter)];
    expect(textDiff > 0.01, `${width}: control: the selected words do show the highlight (${textDiff})`);
    expect(imgDiff < 0.005, `${width}: the picture shows no highlight while everything around it is selected (${imgDiff})`);
    if (process.env.NLB_DEBUG) { writeFileSync(`${OUT}/dbg-${width}-img-before.png`, imgBefore); writeFileSync(`${OUT}/dbg-${width}-img-after.png`, imgAfter); }
    await shot(page, `${width}-01b-select-all`);
    await page.evaluate(() => window.getSelection().removeAllRanges());
    // The hover / selected outline is drawn outside the picture, never on it.
    expect(await image.evaluate((el) => getComputedStyle(el).outlineOffset) === '0px', `${width}: the picture's outline sits outside its edge`);
    await image.hover();
    await page.waitForTimeout(250);
    const hb = await image.boundingBox();
    await page.screenshot({ path: `${OUT}/section-actions-${width}-01c-image-hover.png`, clip: { x: Math.max(0, hb.x - 12), y: hb.y - 12, width: hb.width + 24, height: hb.height + 24 } });
    const edge = await image.locator('img[data-nl-image]').screenshot();
    const hoverDiff = await pixelDiff(page, imgBefore, edge);
    expect(hoverDiff < 0.005, `${width}: hovering draws nothing on the picture (${hoverDiff})`);
    if (process.env.NLB_DEBUG) writeFileSync(`${OUT}/dbg-${width}-img-hover.png`, edge);
    await page.mouse.move(2, 2);

    // Selected: same box; the outline is drawn on top of the edge, not as a frame around an inset picture.
    await image.focus();
    await expectVisible(preview.getByRole('toolbar', { name: 'Image section actions' }), `${width}: image selected`);
    fill = await imageFillsSection(page, image);
    expect(fill.ok, `${width}: selected picture still fills its section (${fill.detail})`);
    const panel = image.getByRole('button', { name: 'Replace image' });
    const [pb, fb2] = [await panel.boundingBox(), await image.boundingBox()];
    expect(pb && fb2 && pb.x >= fb2.x + 19, `${width}: the image's controls keep the column's side padding`);
    await partShot(image, `${width}-02-image-selected`);

    // ---- 5. Duplicate on every section type --------------------------------------------------------------------------
    for (const id of ['bt1', 'bx1', 'bi1', 'bu1', 'bd1', 'by1', 'bc1']) {
      const original = EVERY().find((b) => b.id === id);
      const before = await order();
      const frame = frameOf(id);
      await frame.scrollIntoViewIfNeeded();
      await frame.focus();
      const bar = preview.getByRole('toolbar', { name: `${LABEL[original.type]} section actions` });
      await expectVisible(bar, `${width}: ${original.type} selected`);
      const names = await bar.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
      const at = names.indexOf('Duplicate');
      expect(at > 0 && names[at - 1] === 'Move down' && names[at + 1] === 'Delete section', `${width}: ${original.type}: Duplicate sits between Move down and Delete (${names.join(', ')})`);
      const dup = bar.getByRole('button', { name: 'Duplicate', exact: true });
      expect(await dup.getAttribute('title') === 'Duplicate', `${width}: ${original.type}: tooltip "Duplicate"`);
      expect(await inViewport(page, dup), `${width}: ${original.type}: Duplicate is in view`);
      if (id === 'bt1') await partShot(bar, `${width}-03-action-bar`);
      await dup.click();
      const blocks = await until((b) => b.length === before.length + 1, `${original.type} duplicated`);
      const i = blocks.findIndex((b) => b.id === id);
      const copy = blocks[i + 1];
      expect(copy && copy.id !== id && copy.type === original.type, `${width}: ${original.type}: the copy is right below it`);
      if (original.type === 'campaigns') {
        expect(JSON.stringify(copy.data.selections) === JSON.stringify(original.data.selections) && copy.data.columns === 2
          && copy.data.overrides?.['campaign:601']?.title === 'Our fall event' && copy.data.overrides?.['campaign:601']?.button_text === 'Come along',
        `${width}: campaigns copy keeps picks, columns and card edits (${JSON.stringify(copy?.data)})`);
      } else {
        expect(JSON.stringify(copy?.data) === JSON.stringify(blocks[i].data), `${width}: ${original.type}: same data (${JSON.stringify(copy?.data)} vs ${JSON.stringify(blocks[i].data)})`);
      }
      // The copy is the selected section, in view, with keyboard focus.
      const copyFrame = frameOf(copy.id);
      await expectVisible(copyFrame.locator('xpath=self::*[@data-nl-selected="true"]'), `${width}: ${original.type}: the copy is selected`);
      expect(await frameOf(id).getAttribute('data-nl-selected') === null, `${width}: ${original.type}: the original is no longer selected`);
      expect(await copyFrame.evaluate((el) => el.contains(document.activeElement)), `${width}: ${original.type}: focus is on the copy`);
      if (original.type === 'campaigns') {
        await expectVisible(copyFrame.getByText('Our fall event'), `${width}: the copied card shows its edited title`);
      }
      if (id === 'bi1') {
        const copyFill = await imageFillsSection(page, copyFrame);
        expect(copyFill.ok, `${width}: the copied picture is full-bleed too (${copyFill.detail})`);
      }
      if (id === 'bt1' || id === 'bc1') await shot(page, `${width}-04-duplicated-${original.type}`);
    }
    expect((await order()).length === 15, `${width}: 8 sections + 7 copies`);

    // The Message section: no Duplicate.
    await frameOf(MESSAGE).scrollIntoViewIfNeeded();
    await frameOf(MESSAGE).focus();
    const msgBar = preview.getByRole('toolbar', { name: 'Text section actions' });
    await expectVisible(msgBar, `${width}: message selected`);
    expect(await msgBar.getByRole('button', { name: 'Duplicate' }).count() === 0, `${width}: no Duplicate on the Message section`);
    await partShot(msgBar, `${width}-05-message-bar`);

    // ---- 7. Button options ------------------------------------------------------------------------------------------
    const button = frameOf('bu1');
    await button.scrollIntoViewIfNeeded();
    await button.focus();
    const full = button.getByLabel('Full width');
    const newWindow = button.getByLabel('Open in new window');
    await expectVisible(full, `${width}: Full width tick`);
    expect(await inViewport(page, full) && await inViewport(page, newWindow), `${width}: both ticks in view`);
    expect(!(await full.isChecked()) && !(await newWindow.isChecked()), `${width}: an older button has neither ticked (opens as before)`);
    const pill = button.locator('[data-nl-button]');
    const autoBox = await pill.boundingBox();
    await partShot(button, `${width}-06-button-older`);
    await full.check();
    await newWindow.check();
    let blocks = await until((b) => b.find((x) => x.id === 'bu1')?.data?.full_width === true && b.find((x) => x.id === 'bu1')?.data?.new_window === true, 'full width + new window saved');
    const fullBox = await pill.boundingBox();
    const fb = await button.boundingBox();
    const sidePad = width === 390 ? 20 : 40;
    expect(fullBox && autoBox && fullBox.width > autoBox.width && close(fullBox.x, fb.x + sidePad, 1.5) && close(fullBox.width, fb.width - 2 * sidePad, 1.5),
      `${width}: full width spans the content (${JSON.stringify({ autoBox, fullBox, fb })})`);
    await partShot(button, `${width}-07-button-full-width`);
    // Unticking removes the key (as the API stores it).
    await full.uncheck();
    blocks = await until((b) => { const d = b.find((x) => x.id === 'bu1')?.data; return d && !('full_width' in d) && d.new_window === true; }, 'full width off: key removed');
    const offBox = await pill.boundingBox();
    expect(offBox && close(offBox.width, autoBox.width, 1), `${width}: back to its own width`);
    await full.check();
    await until((b) => b.find((x) => x.id === 'bu1')?.data?.full_width === true, 'full width on again');

    // A new button: Open in new window is ticked from the start.
    await preview.getByRole('button', { name: 'Add a section after section 15' }).scrollIntoViewIfNeeded();
    await preview.getByRole('button', { name: 'Add a section after section 15' }).click();
    await page.getByRole('menuitem', { name: /^Button/ }).click();
    blocks = await until((b) => b.length === 16 && b[15].type === 'button', 'new button added');
    expect(blocks[15].data.new_window === true && !('full_width' in blocks[15].data), `${width}: a new button opens in a new window, not full width (${JSON.stringify(blocks[15].data)})`);
    const newFrame = frameOf(blocks[15].id);
    expect(await newFrame.getByLabel('Open in new window').isChecked(), `${width}: the new button shows Open in new window ticked`);
    await newFrame.getByLabel('Opens this link').fill('https://serpachrysler.ca/book');
    await newFrame.getByLabel('Button text').click();
    await until((b) => b[15]?.data?.url === 'https://serpachrysler.ca/book', 'new button link');
    await partShot(newFrame, `${width}-08-button-new`);

    expect(!(await hasOverflow(page)), `${width}: no sideways scroll`);
    // Done: the preview shows it as the email will (full-width button, full-bleed picture).
    await newFrame.getByRole('button', { name: 'Done' }).click();
    await shot(page, `${width}-09-done`);

    if (width === 1280 && process.env.NLB_PAYLOAD) {
      writeFileSync(process.env.NLB_PAYLOAD, JSON.stringify(savedBlocks(api), null, 2));
      console.log('payload', process.env.NLB_PAYLOAD);
    }

    // The exact email (the API's own rendering of these blocks, when there): the same full-bleed picture and button.
    const emailFile = process.env.NLB_EMAIL;
    if (emailFile && existsSync(emailFile)) {
      // The preview iframe is fully sandboxed (an opaque origin) and its picture requests never reach the test's
      // routes: the same picture goes in as a data: link (the markup is otherwise the API's, unchanged).
      const EXACT = `data:image/svg+xml;base64,${Buffer.from(COLLAGE).toString('base64')}`;
      const html = readFileSync(emailFile, 'utf8').split(PHOTO).join(EXACT);
      await page.route('**/newsletters/71/preview', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { html } }) }));
      await preview.getByRole('button', { name: 'Preview exact email' }).click();
      const dialog = page.getByRole('dialog').filter({ has: page.locator('iframe') });
      await expectVisible(dialog.locator('iframe'), `${width}: exact email shown`);
      await page.waitForTimeout(800);
      const frame = page.frames().find((f) => f !== page.mainFrame() && f.url() !== page.url());
      if (frame) {
        const m = await frame.evaluate(() => {
          const card = document.querySelector('[data-newsletter="card"]').getBoundingClientRect();
          const imgs = [...document.querySelectorAll('td[data-nl-image] img')].map((i) => Object.assign(i.getBoundingClientRect().toJSON(), { nat: i.naturalWidth }));
          const links = [...document.querySelectorAll('a[target="_blank"]')].filter((a) => /serpachrysler\.ca\/(rsvp|book)/.test(a.href)).map((a) => [a.getAttribute('href'), a.getAttribute('rel')]);
          const plain = [...document.querySelectorAll('a[href="https://serpachrysler.ca/rsvp"]:not([target])')].length;
          const bars = [...document.querySelectorAll('table[width="100%"] a[style*="display:block;padding:14px"]')].map((a) => a.getBoundingClientRect().width);
          return { card: { x: card.x, w: card.width }, imgs: imgs.map((r) => ({ x: r.x, w: r.width, nat: r.nat })), links, plain, bars, cardW: card.width };
        });
        expect(m.imgs.length === 2 && m.imgs.every((r) => r.nat > 0 && close(r.x, m.card.x + 1, 1) && close(r.w, m.card.w - 2, 1)), `${width}: exact email: both pictures span the card (${JSON.stringify(m)})`);
        expect(m.links.length === 2 && m.links.every(([, rel]) => rel === 'noopener noreferrer'), `${width}: exact email: the two new-window buttons have target _blank + noopener (${JSON.stringify(m.links)})`);
        expect(m.plain === 1, `${width}: exact email: the copy made before ticking (an older-style button) has no target (${m.plain})`);
        expect(m.bars.length === 1 && m.bars[0] >= m.cardW - 2 * (m.cardW < 600 ? 20 : 40) - 2.5, `${width}: exact email: the full-width button spans the content (${JSON.stringify(m.bars)}, card ${m.cardW})`);
      } else expect(false, `${width}: exact email frame found`);
      await shot(page, `${width}-10-exact-email`);
      await page.keyboard.press('Escape');
    }
    await context.close();
  }

  // ---- 5. the section limit ------------------------------------------------------------------------------------------
  const forty = Array.from({ length: 40 }, (_, i) => ({ id: `d${i}`, type: i === 0 ? 'title' : 'divider', data: i === 0 ? { text: 'Full', size: 'large' } : { style: 'line' } }));
  const api = createMockApi({ newsletters: [newsletter(72, { name: 'Full', subject: 'Full', blocks: forty })] });
  const { page, context } = await open({ width: 1280, height: 1000, api, query: '&newsletterId=72' });
  const preview = page.locator('aside');
  await expectVisible(preview.locator('[data-block-id="d0"]'), 'full draft opened');
  await page.waitForTimeout(800);
  await preview.locator('[data-block-id="d0"]').focus();
  const fullDup = preview.getByRole('toolbar', { name: 'Title section actions' }).getByRole('button', { name: 'Duplicate', exact: true });
  await expectVisible(fullDup, 'Duplicate shown on a full email');
  // Off, like the "+" buttons, with the same words as their tooltip.
  expect(await fullDup.isDisabled(), 'Duplicate is off at 40 sections');
  expect(await fullDup.getAttribute('title') === 'You can add up to 40 sections.', `the limit message is its tooltip (${await fullDup.getAttribute('title')})`);
  const plus = preview.getByRole('button', { name: /^Add a section after section 1$/ });
  expect(await plus.isDisabled() && await plus.getAttribute('title') === 'You can add up to 40 sections.', 'the "+" buttons are off with the same words');
  expect(await preview.locator('[data-block-id]').count() === 40, 'still 40 sections');
  await partShot(preview.getByRole('toolbar', { name: 'Title section actions' }), '1280-11-limit-bar');
  await shot(page, '1280-11-limit');
  await context.close();

  for (const width of [1280, 390]) {
    // ---- 6. a small picture keeps its width; an image that ends the email has no gap under it ----------------------
    const api2 = createMockApi({ uploadUrl: 'https://127.0.0.1/nl-img/pwa-icon-192.png', newsletters: [newsletter(74, { name: 'Small', subject: 'Small', blocks: [{ id: 'bt1', type: 'title', data: { text: 'Logo below', size: 'large' } }] })] });
    const two = await open({ width, height: width === 390 ? 844 : 1100, api: api2, query: '&newsletterId=74' });
    const p2 = two.page.locator('aside');
    await expectVisible(p2.locator('[data-block-id="bt1"]'), `${width}: small-picture draft opened`);
    await two.page.waitForTimeout(600);
    await p2.getByRole('button', { name: 'Add a section after section 1' }).click();
    await two.page.getByRole('menuitem', { name: /^Image/ }).click();
    const imgFrame = p2.locator('[role="group"][aria-label="Image section"]');
    // The upload is answered with a 192 px wide picture (narrower than the card's 598).
    await imgFrame.locator('input[type="file"]').setInputFiles(new URL('../../../../public/pwa-icon-192.png', import.meta.url).pathname);
    let saved = null;
    for (let i = 0; i < 50; i += 1) {
      saved = savedBlocks(api2)?.find((b) => b.type === 'image');
      if (saved?.data?.width) break;
      await two.page.waitForTimeout(150);
    }
    expect(saved?.data?.width === 192, `${width}: a small picture's width is saved (${JSON.stringify(saved?.data)})`);
    const small = imgFrame.locator('img[data-nl-image]');
    const [sb, fb3] = [await small.boundingBox(), await imgFrame.boundingBox()];
    const expectW = 192;
    expect(sb && close(sb.width, expectW, 1) && close(sb.x + sb.width / 2, fb3.x + fb3.width / 2, 1), `${width}: drawn at its own width, centred, never stretched (${JSON.stringify({ sb, fb3 })})`);
    await imgFrame.getByRole('button', { name: 'Done' }).click();
    await two.page.mouse.move(2, 2);
    // The image is the last section: nothing under it but the "+" (no 12 px the email doesn't have).
    const list = p2.locator('[data-block-id="bt1"]').locator('xpath=..');
    expect(await list.evaluate((el) => getComputedStyle(el).paddingBottom) === '0px', `${width}: no extra room under a picture that ends the email`);
    await shot(two.page, `${width}-12-small-picture-last`);
    await two.context.close();
  }

  // ---- 5. a Campaigns copy shows its picks at once, even before (or without) its own save ----------------------------
  const api3 = createMockApi({ failPuts: 500, newsletters: [newsletter(75, { name: 'Picks', subject: 'Picks', blocks: [
    { id: 'bc1', type: 'campaigns', data: { selections: [{ kind: 'campaign', id: 601 }, { kind: 'campaign', id: 602 }], campaign_ids: [601, 602], columns: 1, items: [card(601, 'Fall service event')] } },
  ] })] });
  const three = await open({ width: 1280, height: 1100, api: api3, query: '&newsletterId=75' });
  await serve(three.page);
  const p3 = three.page.locator('aside');
  await expectVisible(p3.locator('[data-block-id="bc1"]').getByText('Fall service event'), 'campaigns draft opened');
  await three.page.waitForTimeout(600);
  const note = (await p3.locator('[data-block-id="bc1"] p.text-xs').first().textContent())?.trim();
  await p3.locator('[data-block-id="bc1"]').focus();
  await p3.getByRole('toolbar', { name: 'Campaigns section actions' }).getByRole('button', { name: 'Duplicate', exact: true }).click();
  const copy3 = p3.locator('[data-block-id]').nth(1);
  await expectVisible(copy3.getByText('Fall service event'), 'the copy shows the card');
  await three.page.waitForTimeout(1200); // saving fails here (failPuts): the copy never gets cards of its own
  expect(await copy3.getByText('Getting your picks…').count() === 0, 'the copy never says "Getting your picks…"');
  expect(!!note && await copy3.getByText(note, { exact: true }).count() === 1, `the copy shows the same note as the original (${note})`);
  await partShot(copy3, '1280-13-campaigns-copy-picks');
  await three.context.close();
}
