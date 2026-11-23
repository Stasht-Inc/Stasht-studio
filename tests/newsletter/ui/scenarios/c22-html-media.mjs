// Chris 22 Nov 2026 (Q4 follow-up): a pasted email template keeps its web fonts and pictures; Add image.
// node tests/newsletter/ui/check.mjs c22-html-media
// The newsletter API is mocked as everywhere else, BUT the real network is open for exactly these hosts (allowHosts,
// exact host match): Google Fonts (fonts.googleapis.com / fonts.gstatic.com) and the picture host (picsum.photos and its
// fastly.picsum.photos redirect), so the preview shows real fonts and real pictures. Every other request is aborted.
// The preview HTML is the REAL API output (NewsletterHtmlDocument + NewsletterRenderer) for the fixture templates,
// before and after Add image (tests/newsletter/ui/fixtures/c22-media-*).
// Flow, at 1280 and 390: HTML → paste a Mailchimp-style template (Google Fonts <link> + @import, an @font-face from
// fonts.gstatic.com, https pictures, one http picture, one data: picture, a media query) → the preview loads the three
// web fonts and every picture → "2 pictures switched to https" + "1 picture inside the HTML" with the Add image hint →
// Phone view (1280) → exact email (fonts load there too) → Add image at the cursor: Uploading… → the <img> is in the
// box at the cursor and the preview shows the new picture → Undo takes it out → Redo → an upload error shows at the
// bottom of the card.
import { readFileSync } from 'fs';
import { createMockApi } from '../mock-api.mjs';

const FX = new URL('../fixtures/', import.meta.url).pathname;
const PNG = new URL('../../../../public/pwa-icon-512.png', import.meta.url).pathname;
const fixture = (name) => ({ source: readFileSync(`${FX}${name}-template.html`, 'utf8'), html: readFileSync(`${FX}${name}-email.html`, 'utf8'), ...JSON.parse(readFileSync(`${FX}${name}-preview.json`, 'utf8')) });
const MEDIA = fixture('c22-media');
const ADDED = fixture('c22-media-added');
const UPLOADED = 'https://picsum.photos/id/1035/600/300';
const TAG = `<img src="${UPLOADED}" alt="" style="display:block;max-width:100%;height:auto;" width="600">`;
const MARK = '<p class="script" style="font-size:34px;">';
const ALLOW = ['fonts.googleapis.com', 'fonts.gstatic.com', 'picsum.photos', 'fastly.picsum.photos'];

/** In a frame: wait for its fonts and pictures, then say which web fonts loaded and which pictures failed. */
// Read synchronously through a locator, polled from here: the frames run no scripts, so nothing async (promises,
// timers) ever settles inside them.
async function frameMedia(frameLocator) {
  let last = { fonts: [], pictures: [] };
  for (let i = 0; i < 60; i++) {
    last = await frameLocator.locator('html').evaluate((root) => {
      const doc = root.ownerDocument;
      return {
        fontsDone: doc.fonts.status === 'loaded',
        fonts: [...new Set([...doc.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')))],
        pictures: [...doc.images].map((img) => ({ src: img.getAttribute('src'), done: img.complete, ok: img.naturalWidth > 0 })),
      };
    });
    if (last.fontsDone && last.pictures.every((p) => p.done)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  return last;
}

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  for (const [width, height, tag] of [[1280, 1000, '1280'], [390, 844, '390']]) {
    const phone = tag === '390';
    const api = createMockApi({ htmlDocumentFixture: [MEDIA, ADDED], allowHosts: ALLOW, uploadUrl: UPLOADED, businessAddress: '22 Commercial Dr, Vancouver, BC' });
    console.log(`${tag}: open`);
    const { page, context } = await open({ width, height, api });
    const content = page.locator('#nl-step-content');
    const aside = page.locator('aside');
    const modeSwitch = page.getByRole('radiogroup', { name: 'Email content' });

    await page.locator('#nl-name').fill(`TBP November ${tag}`);
    await page.locator('#nl-subject').fill('November at the studio');
    await modeSwitch.getByRole('radio', { name: 'HTML' }).click();
    const box = content.getByLabel('HTML Content');
    await expectVisible(box, `${tag}: HTML box`);
    const addImage = content.getByRole('button', { name: 'Add image' });
    await expectVisible(addImage, `${tag}: Add image next to the box`);
    const [btnBox, boxBox] = [await addImage.boundingBox(), await box.boundingBox()];
    expect(btnBox && boxBox && btnBox.y + btnBox.height <= boxBox.y + 2 && btnBox.x + btnBox.width <= boxBox.x + boxBox.width + 1, `${tag}: Add image sits on the box's label row, inside the card`);

    // Paste: the real cleaned email, with real fonts and pictures.
    await box.fill(MEDIA.source);
    const frameEl = aside.locator('iframe[title="HTML email preview"]');
    await expectVisible(frameEl, `${tag}: preview`);
    const email = page.frameLocator('iframe[title="HTML email preview"]');
    await expectVisible(email.locator('h1', { hasText: 'Holiday lash packages' }), `${tag}: the template is in the preview`);
    console.log(`${tag}: preview shows`);
    const media = await frameMedia(email).catch((e) => ({ fonts: [], pictures: [], error: e.message }));
    for (const family of ['Playfair Display', 'Montserrat', 'TBP Script']) expect(media.fonts.includes(family), `${tag}: web font ${family} loaded in the preview (${media.fonts.join(', ')} ${media.error ?? ''})`);
    const templatePictures = media.pictures.filter((p) => /picsum\.photos/.test(p.src ?? ''));
    expect(templatePictures.length === 3 && templatePictures.every((p) => p.ok), `${tag}: the template's pictures load (${JSON.stringify(media.pictures)})`);
    expect(templatePictures.some((p) => p.src === 'https://picsum.photos/id/1011/400/300'), `${tag}: the http picture shows, switched to https`);
    expect(await email.locator('img[src^="data:"], [srcset]').count() === 0, `${tag}: no data: picture or srcset in the email`);
    const h1Font = await email.locator('h1').first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(/Playfair Display/.test(h1Font) && /Georgia/.test(h1Font), `${tag}: the template's font stack is kept (${h1Font})`);
    const footerFont = await email.locator('[data-newsletter="footer"] td').first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(/^-apple-system/.test(footerFont), `${tag}: our footer keeps its own fonts (${footerFont})`);
    await expectVisible(content.getByText('2 pictures switched to https.'), `${tag}: switched note`);
    const removedNote = content.locator('[data-nl-html-removed]');
    await expectVisible(removedNote, `${tag}: removed note`);
    const removedText = await removedNote.innerText().catch(() => '');
    expect(/We removed 5 unsupported items: 1 picture inside the HTML, 2 style sheets, 2 web fonts/.test(removedText), `${tag}: removed items (${removedText})`);
    expect(/Pictures removed: data:image\/png;base64,iVBOR/.test(removedText), `${tag}: the removed picture is listed`);
    expect(/Gmail blocks pictures saved inside the HTML\. Use Add image to upload them\./.test(removedText), `${tag}: the Add image hint`);
    expect(await aside.locator('[data-nl-html-broken-pictures]').count() === 0, `${tag}: every picture loaded, no warning`);
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll`);
    await page.waitForTimeout(300);
    await shot(page, `${tag}-01-fonts-and-pictures`);
    if (phone) {
      await content.scrollIntoViewIfNeeded();
      await page.screenshot({ path: shotPath(tag, '01b-box-and-notes'), fullPage: false });
      await frameEl.scrollIntoViewIfNeeded();
      await page.screenshot({ path: shotPath(tag, '01c-preview'), fullPage: false });
    } else {
      await aside.getByRole('radio', { name: 'Phone view' }).click();
      await page.waitForTimeout(800);
      await shot(page, `${tag}-02-phone-view`);
      await aside.getByRole('radio', { name: 'Desktop view' }).click();
    }

    // The exact email (a frame with no same-origin access): the web fonts load there too.
    await page.getByRole('button', { name: 'Preview exact email' }).first().click();
    const exact = page.frameLocator('iframe[title="Exact email preview"]');
    await expectVisible(exact.locator('h1', { hasText: 'Holiday lash packages' }), `${tag}: exact email`);
    const exactMedia = await frameMedia(exact).catch((e) => ({ fonts: [], pictures: [], error: e.message }));
    for (const family of ['Playfair Display', 'Montserrat', 'TBP Script']) expect(exactMedia.fonts.includes(family), `${tag}: exact email loads ${family} (${exactMedia.fonts.join(', ')} ${exactMedia.error ?? ''})`);
    await page.waitForTimeout(400);
    await shot(page, `${tag}-03-exact-email`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Add image at the cursor (just above "Connect with us on Instagram"): Uploading… then the tag is in the box.
    await page.waitForTimeout(1200); // the paste is saved
    const at = MEDIA.source.indexOf(MARK);
    await box.evaluate((el, at) => { el.focus(); el.setSelectionRange(at, at); }, at);
    api.state.uploadDelayMs = 1500;
    const chooser = page.waitForEvent('filechooser');
    await addImage.click();
    await (await chooser).setFiles(PNG);
    await expectVisible(content.getByRole('button', { name: 'Uploading…' }), `${tag}: Uploading…`);
    await shot(page, `${tag}-04-uploading`);
    await expectVisible(content.getByRole('button', { name: 'Add image' }), `${tag}: upload done`);
    const after = await box.inputValue();
    expect(after === ADDED.source, `${tag}: the <img> went in at the cursor (${after.length} vs ${ADDED.source.length})`);
    expect(api.state.uploads.length === 1 && /image\//.test(api.state.uploads[0].type ?? ''), `${tag}: one upload through POST /newsletters/images (${JSON.stringify(api.state.uploads)})`);
    await page.waitForTimeout(1500); // saved, preview refreshed
    const saved = api.state.newsletters[0];
    expect(saved?.content?.html_document === ADDED.source.trim(), `${tag}: the new HTML is saved`);
    const added = email.locator(`img[src="${UPLOADED}"]`);
    await expectVisible(added, `${tag}: the new picture is in the preview`);
    const addedOk = (await frameMedia(email).catch(() => ({ pictures: [] }))).pictures.some((p) => p.src === UPLOADED && p.ok);
    expect(addedOk, `${tag}: and it loads`);
    await added.scrollIntoViewIfNeeded().catch(() => {});
    await shot(page, `${tag}-05-image-added`);
    if (phone) {
      await box.scrollIntoViewIfNeeded();
      await box.evaluate((el, at) => { el.focus(); el.setSelectionRange(at, at); const line = 20; el.scrollTop = Math.max(0, el.value.slice(0, at).split('\n').length * line - 120); }, at);
      await page.screenshot({ path: shotPath(tag, '05b-tag-in-box'), fullPage: false });
    }

    // Undo takes the picture out again; Redo puts it back.
    await box.focus();
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForTimeout(200);
    expect(await box.inputValue() === MEDIA.source, `${tag}: Undo removes the inserted picture`);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await page.waitForTimeout(200);
    expect(await box.inputValue() === ADDED.source, `${tag}: Redo puts it back`);

    // An upload the API refuses: the message at the bottom of the card, the box unchanged.
    api.state.uploadDelayMs = 0;
    api.state.uploadFailMessage = 'The image must be smaller than 5 MB.';
    const chooser2 = page.waitForEvent('filechooser');
    await addImage.click();
    await (await chooser2).setFiles(PNG);
    const err = content.locator('[data-nl-html-image-error]');
    await expectVisible(err, `${tag}: upload error`);
    expect((await err.innerText().catch(() => '')) === 'The image must be smaller than 5 MB.', `${tag}: the API's message`);
    const errBox = await err.boundingBox();
    const cardBox = await content.boundingBox();
    expect(errBox && cardBox && cardBox.y + cardBox.height - (errBox.y + errBox.height) < 40, `${tag}: the error is at the bottom of the card`);
    expect(await box.inputValue() === ADDED.source, `${tag}: the box is unchanged`);
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll`);
    await err.scrollIntoViewIfNeeded();
    await page.screenshot({ path: shotPath(tag, '06-upload-error'), fullPage: false });
    await context.close();
  }
}

function shotPath(tag, file) {
  const dir = process.env.NL_SHOTS || '/private/tmp/claude-501/newsletters-ui/shots';
  console.log('shot', `${dir}/c22-html-media-${tag}-${file}.png`);
  return `${dir}/c22-html-media-${tag}-${file}.png`;
}
