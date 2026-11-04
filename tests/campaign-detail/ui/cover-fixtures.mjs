// Shared mocks for the campaign cover checks (Chris, 4 Nov 2026): a small square brand logo (like the 8abfd1b2
// screenshot's blue "G" avatar), a real camera-sized photo, and moment photos — made locally with sharp.
import sharp from 'sharp';

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#0B1442"/>
  <polygon points="128,28 214,78 214,178 128,228 42,178 42,78" fill="#1D4ED8"/>
  <polygon points="128,62 184,94 184,162 128,194 72,162 72,94" fill="#0B1442"/>
  <polygon points="128,92 160,110 160,146 128,164 96,146 96,110" fill="#3B82F6"/>
  <rect x="128" y="120" width="56" height="26" fill="#1D4ED8"/>
</svg>`;

// A 3:1 wordmark (600x200), like a dealer's text logo: must never lose its sides.
const WIDE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200">
  <rect width="600" height="200" fill="#FFFFFF"/>
  <rect x="10" y="10" width="580" height="180" rx="16" fill="#0F172A"/>
  <circle cx="60" cy="100" r="34" fill="#F59E0B"/>
  <text x="110" y="122" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#FFFFFF">NORTHWIND</text>
  <rect x="560" y="30" width="16" height="140" fill="#F59E0B"/>
</svg>`;

const PHOTO_SVG = (w, h, hue) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 2000 1500">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,62%)"/><stop offset="1" stop-color="hsl(${hue + 30},80%,88%)"/></linearGradient></defs>
  <rect width="2000" height="1500" fill="url(#sky)"/>
  <circle cx="1500" cy="380" r="160" fill="#FDE68A"/>
  <polygon points="0,1100 500,520 900,1000 1300,600 2000,1150 2000,1500 0,1500" fill="hsl(${hue + 120},35%,32%)"/>
  <polygon points="0,1300 700,900 1400,1250 2000,1000 2000,1500 0,1500" fill="hsl(${hue + 120},40%,22%)"/>
</svg>`;

const cache = new Map();
export async function imageFor(name) {
  if (cache.has(name)) return cache.get(name);
  let body;
  if (name === 'logo.png') body = await sharp(Buffer.from(LOGO_SVG)).png().toBuffer();
  else if (name === 'photo.jpg') body = await sharp(Buffer.from(PHOTO_SVG(2000, 1500, 205))).jpeg({ quality: 80 }).toBuffer();
  else if (name === 'wide.png') body = await sharp(Buffer.from(WIDE_SVG)).png().toBuffer();
  else if (name === 'photo640.jpg') body = await sharp(Buffer.from(PHOTO_SVG(640, 480, 120))).jpeg({ quality: 80 }).toBuffer();
  else if (name === 'small.jpg') body = await sharp(Buffer.from(PHOTO_SVG(240, 180, 20))).jpeg({ quality: 80 }).toBuffer();
  else {
    const n = Number(name.match(/(\d+)/)?.[1] ?? 1);
    body = await sharp(Buffer.from(PHOTO_SVG(900, 675, (n * 70) % 360))).jpeg({ quality: 75 }).toBuffer();
  }
  const out = { body, contentType: name.endsWith('.png') ? 'image/png' : 'image/jpeg' };
  cache.set(name, out);
  return out;
}

export const STUB_STRIPE = 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};';
export const STUB_GAPI = 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};';

/** Box of a visible cover and of its picture: { mode, box, img } (img = the main, not the blurred, picture). */
export async function coverInfo(locator) {
  if ((await locator.count()) === 0) return null;
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const img = el.querySelector('img:not([aria-hidden="true"])');
    const ir = img ? img.getBoundingClientRect() : null;
    return {
      mode: el.getAttribute('data-cover-mode'),
      shape: el.getAttribute('data-cover-shape'),
      blurred: !!el.querySelector('img[aria-hidden="true"]'),
      src: img ? img.getAttribute('src') : null,
      box: { width: Math.round(r.width), height: Math.round(r.height) },
      img: ir ? { width: Math.round(ir.width), height: Math.round(ir.height), natural: img.naturalWidth, radius: getComputedStyle(img).borderRadius, fit: getComputedStyle(img).objectFit } : null,
    };
  });
}
