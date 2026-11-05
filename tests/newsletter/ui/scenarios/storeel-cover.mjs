// Create New Campaign: "Cover photo | Add Intro Video" (Chris, 4 Nov 2026, point 5) — one row, Cover photo on the
// left. Both are saved as the campaign's cover (last_update_img), so it is one or the other: choosing a cover photo
// replaces the intro video and the other way round. The cover photo is sent as last_update_img on create.
// Point 6: the live preview's cover follows it — cover photo, intro video (first frame), else the BRAND (the account
// avatar, shown as the round avatar over a blurred copy, not stretched; never the first photo, never grey).
// node tests/newsletter/ui/check.mjs storeel-cover   (NL_BASE = the dev server)
import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { IMG, createMockApi } from '../mock-api.mjs';
import { imageFor } from '../../../campaign-detail/ui/cover-fixtures.mjs';

const STOREEL_TITLE = 'Give your campaign a meaningful title';
const LOGO = 'https://127.0.0.1/cd-img/logo.png';
const VIDEO_URL = 'https://127.0.0.1/cd-img/intro.mp4';
// The account's brand: a small square logo as the profile image (like Next Summit's blue "G").
const USER = {
  id: 1, external_user_id: 990002, name: 'Next Summit', email: 'hello@nextsummit.test', role: '2',
  phone_number: '+1 416 555 0100', profile_image: LOGO, avatar: LOGO, profile_color: '#1D4ED8',
};

// A real-looking cover photo, and a short real video (ffmpeg) so the preview can show its first frame.
async function fixtures() {
  const photo = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#F59E0B' } })
    .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><circle cx="1200" cy="300" r="180" fill="#FDE68A"/><polygon points="0,1000 600,380 1000,820 1600,420 1600,1000" fill="#7C2D12"/></svg>') }])
    .jpeg({ quality: 80 }).toBuffer();
  let video = Buffer.from('not really a video');
  const dir = mkdtempSync(join(tmpdir(), 'storeel-cover-'));
  const out = join(dir, 'intro.mp4');
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x10B981:s=640x360:d=1', '-vf', 'drawbox=x=220:y=100:w=200:h=160:color=white@0.9:t=fill', '-pix_fmt', 'yuv420p', '-y', out]);
  if (r.status === 0) video = readFileSync(out);
  return { photo, video };
}

const previewCover = (page) => page.getByTestId('storeel-preview-cover');
const coverKind = (page) => previewCover(page).getAttribute('data-cover-kind');

export async function run({ open, shot, expectVisible, expect, hasOverflow }) {
  const { photo, video } = await fixtures();
  for (const [width, height] of [[1280, 1000], [390, 844]]) {
    const tag = String(width);
    const api = createMockApi();
    const baseRoute = api.route;
    // The intro video upload (/memories/upload-video answers {fileUrl}), and the logo / video files.
    let slowFailingPhoto = false;
    api.route = async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' && url.pathname === '/cd-img/intro.mp4') return route.fulfill({ body: video, contentType: 'video/mp4' });
      if (url.hostname === '127.0.0.1' && url.pathname.startsWith('/cd-img/')) {
        const { body, contentType } = await imageFor(url.pathname.slice('/cd-img/'.length));
        return route.fulfill({ body, contentType });
      }
      // A slow cover-photo upload that then fails (review check: removed while uploading → no toast, upload stopped).
      if (url.pathname === '/api/react/user/upload-image-with-metadata' && slowFailingPhoto) {
        await new Promise((r) => setTimeout(r, 1200));
        return route.fulfill({ status: 500, json: { success: false, message: 'Server error' } }).catch(() => {});
      }
      if (url.pathname === '/api/react/memories/upload-video') {
        api.state.calls.push({ method: 'POST', path: '/memories/upload-video' });
        await new Promise((r) => setTimeout(r, 400));
        return route.fulfill({ json: { success: true, fileUrl: VIDEO_URL } });
      }
      return baseRoute(route);
    };
    const { page, context } = await open({ width, height, api, user: USER });
    await page.locator('#nl-name').waitFor();
    await page.getByRole('radio', { name: 'Storeel', exact: true }).click();
    await page.getByPlaceholder(STOREEL_TITLE).waitFor();
    await page.waitForTimeout(800); // categories load

    // The row: Cover photo on the left, Intro Video on the right, "or" between.
    const addCover = page.getByRole('button', { name: 'Add Cover Photo' });
    const addVideo = page.getByRole('button', { name: 'Add Intro Video' });
    await expectVisible(addCover, `${tag}: Add Cover Photo button`);
    await expectVisible(addVideo, `${tag}: Add Intro Video button`);
    const cb = await addCover.boundingBox();
    const vb = await addVideo.boundingBox();
    expect(cb && vb && Math.abs(cb.y - vb.y) <= 1 && cb.x + cb.width <= vb.x, `${tag}: one row, Cover photo left of Intro Video (${JSON.stringify(cb)} / ${JSON.stringify(vb)})`);
    expect(cb && vb && Math.abs(cb.width - vb.width) <= 1, `${tag}: both halves the same width`);
    await expectVisible(page.getByText('Cover photo', { exact: true }), `${tag}: Cover photo label`);
    await expectVisible(page.getByText('or', { exact: true }), `${tag}: "or" between them`);
    expect(!(await hasOverflow(page)), `${tag}: no sideways scroll`);
    await page.getByPlaceholder(STOREEL_TITLE).fill('Next Summit / 25');

    // Point 6: nothing chosen → the preview's cover is the brand, as the round avatar (≤ 60% of the cover's height).
    await page.waitForTimeout(500);
    expect(await coverKind(page) === 'brand', `${tag}: preview cover is the brand (got ${await coverKind(page)})`);
    const brand = previewCover(page).locator('[data-cover-mode="brand"]');
    expect(await brand.count() === 1, `${tag}: brand shown with the avatar treatment, not stretched`);
    if (await brand.count()) {
      const info = await brand.evaluate((el) => {
        const img = el.querySelector('img:not([aria-hidden="true"])');
        const r = el.getBoundingClientRect(); const i = img.getBoundingClientRect();
        return { boxH: r.height, w: i.width, h: i.height, src: img.getAttribute('src') };
      });
      expect(info.src === LOGO && info.w === info.h && info.w <= Math.ceil(info.boxH * 0.6) + 1, `${tag}: brand avatar ${info.w}x${info.h} in a ${info.boxH}px cover (${info.src})`);
    }
    await addCover.scrollIntoViewIfNeeded();
    await shot(page, `${tag}-01-row-empty`);
    if (width < 1024) {
      await page.getByTestId('storeel-preview').scrollIntoViewIfNeeded();
      await shot(page, `${tag}-01b-preview-brand`);
    }

    // Cover photo chosen → its chip on the left; the Intro Video button stays.
    await page.getByTestId('cover-photo-input').setInputFiles({ name: 'storefront.jpg', mimeType: 'image/jpeg', buffer: photo });
    const photoChip = page.getByTestId('cover-choice-photo');
    await expectVisible(photoChip, `${tag}: cover photo chip`);
    await page.waitForTimeout(600);
    expect((await photoChip.textContent()).includes('storefront.jpg') && !(await photoChip.textContent()).includes('Uploading'), `${tag}: chip shows the file, uploaded`);
    expect(await addVideo.isVisible(), `${tag}: Add Intro Video still offered`);
    expect(await coverKind(page) === 'photo', `${tag}: preview cover is the cover photo (got ${await coverKind(page)})`);
    const coverSrc = await previewCover(page).locator('img:not([aria-hidden="true"])').first().getAttribute('src');
    expect(/^blob:/.test(coverSrc || '') && await previewCover(page).locator('[data-cover-mode="cover"]').count() === 1, `${tag}: the cover photo fills the preview cover (${coverSrc})`);
    await shot(page, `${tag}-02-cover-photo-chosen`);
    if (width < 1024) {
      await page.getByTestId('storeel-preview').scrollIntoViewIfNeeded();
      await shot(page, `${tag}-02b-preview-cover-photo`);
    }

    // Intro video chosen → replaces the cover photo.
    await page.getByTestId('intro-video-input').setInputFiles({ name: 'welcome.mp4', mimeType: 'video/mp4', buffer: video });
    const videoChip = page.getByTestId('cover-choice-video');
    await expectVisible(videoChip, `${tag}: intro video chip`);
    expect(!(await photoChip.isVisible().catch(() => false)), `${tag}: choosing the intro video cleared the cover photo`);
    await expectVisible(addCover, `${tag}: Add Cover Photo offered again`);
    await page.waitForTimeout(800);
    expect(!(await videoChip.textContent()).includes('Uploading'), `${tag}: intro video uploaded`);
    expect(await coverKind(page) === 'video' && await previewCover(page).locator('video').count() === 1, `${tag}: preview cover is the intro video (got ${await coverKind(page)})`);
    await page.waitForTimeout(800); // first frame
    await shot(page, `${tag}-03-intro-video-chosen`);
    if (width < 1024) {
      await page.getByTestId('storeel-preview').scrollIntoViewIfNeeded();
      await shot(page, `${tag}-03b-preview-intro-video`);
    }

    // Cover photo again → replaces the intro video.
    await page.getByTestId('cover-photo-input').setInputFiles({ name: 'storefront.jpg', mimeType: 'image/jpeg', buffer: photo });
    await expectVisible(photoChip, `${tag}: cover photo chip again`);
    expect(!(await videoChip.isVisible().catch(() => false)), `${tag}: choosing the cover photo cleared the intro video`);
    await page.waitForTimeout(600);

    // A wrong file type is refused (same types as the Media picker).
    await page.getByTestId('cover-photo-input').setInputFiles({ name: 'anim.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
    await expectVisible(page.getByText('Please choose a JPG, JPEG or PNG photo.'), `${tag}: GIF refused`);
    expect((await photoChip.textContent()).includes('storefront.jpg'), `${tag}: the chosen cover photo stays`);

    // Review: a cover photo removed while it is still uploading — the upload is stopped, and its failure never toasts.
    {
      await page.getByRole('button', { name: 'Remove cover photo' }).click();
      const aborted = [];
      page.on('requestfailed', (r) => { if (r.url().includes('/user/upload-image-with-metadata')) aborted.push(r.failure()?.errorText); });
      slowFailingPhoto = true;
      await page.getByTestId('cover-photo-input').setInputFiles({ name: 'slow.jpg', mimeType: 'image/jpeg', buffer: photo });
      await expectVisible(photoChip, `${tag}: slow cover photo uploading`);
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: 'Remove cover photo' }).click();
      await page.waitForTimeout(1800);
      slowFailingPhoto = false;
      expect(!(await page.getByText('could not be uploaded').first().isVisible().catch(() => false)), `${tag}: no "could not be uploaded" toast for a removed photo`);
      expect(aborted.length > 0, `${tag}: the removed photo's upload was stopped (${JSON.stringify(aborted)})`);
      expect(await coverKind(page) === 'brand', `${tag}: preview back to the brand`);
      await page.getByTestId('cover-photo-input').setInputFiles({ name: 'storefront.jpg', mimeType: 'image/jpeg', buffer: photo });
      await expectVisible(photoChip, `${tag}: cover photo chosen again`);
      await page.waitForTimeout(600);
    }

    // Removing it brings the brand back to the preview; then choose it again for the create check.
    await page.getByRole('button', { name: 'Remove cover photo' }).click();
    expect(!(await photoChip.isVisible().catch(() => false)), `${tag}: cover photo removed`);
    expect(await coverKind(page) === 'brand', `${tag}: preview back to the brand after removing (got ${await coverKind(page)})`);
    await page.getByTestId('cover-photo-input').setInputFiles({ name: 'storefront.jpg', mimeType: 'image/jpeg', buffer: photo });
    await expectVisible(photoChip, `${tag}: cover photo chosen again`);
    await page.waitForTimeout(600);

    // Save as Draft (Storeel flow v2, 4 Nov): the cover photo goes as last_update_img.
    await page.getByRole('button', { name: 'Save as Draft', exact: true }).filter({ visible: true }).last().click();
    await page.waitForTimeout(1500);
    const made = api.state.storeels.find((s) => s.title === 'Next Summit / 25');
    expect(made && made.last_update_img === IMG, `${tag}: created with the cover photo as last_update_img (got ${JSON.stringify(made?.last_update_img)})`);

    // The form is reset for next time: nothing chosen. (Save as Draft closed the flow.)
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Open Create Campaign' }).click().catch(() => {});
    await page.waitForTimeout(800);
    const radio = page.getByRole('radio', { name: 'Storeel', exact: true });
    if (await radio.isVisible().catch(() => false)) await radio.click();
    await page.waitForTimeout(400);
    expect(!(await photoChip.isVisible().catch(() => false)), `${tag}: reset after create — no cover photo left over`);
    await context.close();
  }
}
