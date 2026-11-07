// How a campaign cover picture is laid out in its box (Chris, 4 Nov 2026). Pure, so `node --test` loads it.
//
// A campaign with no cover of its own shows the brand — the account / property avatar — and that small logo used to
// be stretched full-bleed (object-cover), hugely zoomed and pixelated. Now:
//  - the brand default is centred, at most 60% of the box and never enlarged past 1.5x its own size, over a backdrop:
//    a square logo as the round avatar (the way the avatar shows everywhere in Studio), any other logo whole (a
//    wordmark's sides are never cut); an SVG brand is sized by the box alone;
//  - a chosen picture under half its box on a side is shown whole, centred, the same way;
//  - real photos stay full-bleed, exactly as before (typical 1024x576 / 640x480 dealer photos included).
// A raster picture waits hidden ('pending') until its size is known, so nothing shows stretched for a frame.

export interface CoverSize { width: number; height: number }

export type CampaignCoverLayout =
  | { mode: 'pending' }
  | { mode: 'cover' }
  | { mode: 'contain'; shape: 'circle' | 'rect'; width: number; height: number };

/** The brand avatar is at most this share of the box's short side. */
export const BRAND_COVER_FRACTION = 0.6;
/** A too-small picture is at most this share of the box (it is a photo, so it gets a little more room). */
export const SMALL_COVER_FRACTION = 0.8;
/** A 'whole' brand (re-review 2, option C) is at most this share of the box's width (it takes the full height). */
export const WHOLE_MAX_WIDTH = 0.9;
/** Never enlarge a picture past this many times its own size. */
export const COVER_MAX_UPSCALE = 1.5;
/** A chosen picture counts as too small only when it is under this share of the box on a side. */
export const COVER_SMALL_SIDE = 0.5;
/** Unused since Chris 7 Nov point 11 (no brand is cut round any more); kept for the 4 Nov tests' record. */
export const BRAND_CIRCLE_ASPECT: [number, number] = [0.85, 1.18];
/** A contained picture sits a little above the middle: covers carry their title, pills and buttons at the bottom. */
export const COVER_CENTER_Y = 0.38;
/** Gap kept between a contained picture and the top / bottom of its box. */
const COVER_EDGE_GAP = 12;

/** Where the middle of a contained picture goes (px from the top of the box), kept inside the box. */
export function coverCenterTop(boxHeight: number, pictureHeight: number, centerY: number = COVER_CENTER_Y): number {
  const wanted = boxHeight * centerY;
  const min = pictureHeight / 2 + COVER_EDGE_GAP;
  const max = boxHeight - pictureHeight / 2 - COVER_EDGE_GAP;
  return Math.round(max < min ? boxHeight / 2 : Math.min(Math.max(wanted, min), max));
}

/** An SVG picture: it can be enlarged without going blurry (and may report no real size), so it is never "too small". */
export function isVectorImage(src?: string | null): boolean {
  const s = String(src ?? '').trim();
  return /^data:image\/svg\+xml/i.test(s) || /\.svg(?:[?#]|$)/i.test(s);
}

const known = (s?: CoverSize | null): s is CoverSize => !!s && s.width > 0 && s.height > 0;

export function campaignCoverLayout({ isFallback = false, brandKind = null, natural = null, box = null, vector = false, judgeBox = null, brandFraction = BRAND_COVER_FRACTION }: {
  /** The picture is the brand default (account / property avatar), not a cover someone chose. */
  isFallback?: boolean;
  /** What the brand picture is, as the web API judged it (utils/brandPictures, Chris 7 Nov 2026): a 'photo' (the owner's
   *  selfie / headshot avatar) fills the cover like a chosen photo; a 'logo' is drawn whole, never cut to a circle (it
   *  sits on its own solid colour); 'whole' (the API was unsure: a flat backdrop) is drawn whole at the FULL height of
   *  the box, at most WHOLE_MAX_WIDTH of its width, never cut round (re-review 2, option C); not known (null) — the
   *  4 Nov rules below. */
  brandKind?: 'logo' | 'photo' | 'whole' | null;
  /** The brand's largest share of the box (default BRAND_COVER_FRACTION). Cards use less: their pills and title leave
   *  little room (Chris, 7 Nov 2026 review). */
  brandFraction?: number;
  /** The picture's own size (naturalWidth / naturalHeight), once it has loaded. */
  natural?: CoverSize | null;
  /** The box it is shown in, in CSS pixels. */
  box?: CoverSize | null;
  /** The picture is an SVG (isVectorImage). */
  vector?: boolean;
  /** Judge "too small" against this box instead of `box` (the Storeel preview's tall phone-screen cover judges against
   *  a square of the phone's width, so an ordinary photo still fills it). The picture is still sized in `box`. */
  judgeBox?: CoverSize | null;
}): CampaignCoverLayout {
  if (isFallback && brandKind === 'whole') {
    if (!known(box) || !known(natural)) return { mode: 'pending' };
    let height = box.height;
    let width = (natural.width / natural.height) * height;
    if (width > WHOLE_MAX_WIDTH * box.width) {
      width = WHOLE_MAX_WIDTH * box.width;
      height = width * (natural.height / natural.width);
    }
    return { mode: 'contain', shape: 'rect', width: Math.round(width), height: Math.round(height) };
  }
  if (isFallback && brandKind !== 'photo') {
    if (!known(box)) return { mode: 'pending' };
    if (vector) {
      return { mode: 'contain', shape: 'rect', width: Math.round(brandFraction * box.width), height: Math.round(brandFraction * box.height) };
    }
    if (!known(natural)) return { mode: 'pending' };
    // Drawn whole, never cut round (Chris 7 Nov point 11: "this needs to be smooth" — the 4 Nov round avatar is gone).
    return containRect(natural, box, brandFraction);
  }
  if (vector) return { mode: 'cover' };
  if (!known(natural)) return { mode: 'pending' };
  if (!known(box)) return { mode: 'cover' };
  const judge = known(judgeBox) ? judgeBox : box;
  if (natural.width >= COVER_SMALL_SIDE * judge.width && natural.height >= COVER_SMALL_SIDE * judge.height) return { mode: 'cover' };
  return containRect(natural, box, SMALL_COVER_FRACTION);
}

function containRect(natural: CoverSize, box: CoverSize, fraction: number): CampaignCoverLayout {
  const scale = Math.min((fraction * box.width) / natural.width, (fraction * box.height) / natural.height, COVER_MAX_UPSCALE);
  return { mode: 'contain', shape: 'rect', width: Math.round(natural.width * scale), height: Math.round(natural.height * scale) };
}

/**
 * A brand fill white text wouldn't read on (contrast under 4.5:1, WCAG): the cover then gets a stronger bottom scrim
 * behind the title / meta (Chris 7 Nov review: "Signing Day" on a white fill was faint). #RRGGBB only.
 */
export function lightCoverFill(color?: string | null): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(String(color ?? '').trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (lum + 0.05) < 4.5;
}

/** The least free height (px) a card's brand is fitted into; with less, the caller frees more room. */
export const MIN_FIT_AREA = 24;

/**
 * A card's brand fitted into its free area (Chris 7 Nov, grid review): between the top pills row and the title's top
 * (px from the box's top) and, when given, between `left` and `right` (the pills column on the right) — at most 90% of
 * that height and 80% of its width (90% of a given span), never enlarged past `maxUpscale`, centred in it, so it never
 * sits behind the title, its scrim or a pill. null when the area is under MIN_FIT_AREA high.
 */
export function fitInArea(natural: CoverSize, box: CoverSize, area: { top: number; bottom: number; left?: number; right?: number }, maxUpscale: number): { width: number; height: number; centerTop: number; centerLeft: number } | null {
  const h = area.bottom - area.top;
  const span = area.left !== undefined && area.right !== undefined ? area.right - area.left : null;
  if (!known(natural) || !known(box) || h < MIN_FIT_AREA || (span !== null && span < MIN_FIT_AREA)) return null;
  const maxW = span !== null ? 0.9 * span : 0.8 * box.width;
  const scale = Math.min(maxW / natural.width, (0.9 * h) / natural.height, maxUpscale);
  return {
    width: Math.round(natural.width * scale),
    height: Math.round(natural.height * scale),
    centerTop: Math.round(area.top + h / 2),
    centerLeft: Math.round(span !== null ? (area.left as number) + span / 2 : box.width / 2),
  };
}

/**
 * The CSS fill behind a logo drawn whole (Chris point 11, "seamless"): its own background colour, or — when that
 * background runs from one colour at the top to another at the bottom — the top colour down to the logo's top, the
 * bottom colour from the logo's bottom, blending between them, so the logo's edges disappear. `at`: where the logo is
 * drawn (px from the box's top, and its height); null until it is laid out.
 */
export function seamlessFill(pic: { color: string | null; gradient: [string, string] | null }, at: { top: number; height: number } | null, fallback = '#FFFFFF'): string {
  const flat = pic.color ?? fallback;
  if (!pic.gradient || !at) return flat;
  const [top, bottom] = pic.gradient;
  const y0 = Math.round(at.top);
  const y1 = Math.round(at.top + at.height);
  return `linear-gradient(to bottom, ${top} 0px, ${top} ${y0}px, ${bottom} ${y1}px, ${bottom} 100%)`;
}

/** The colour behind a contained cover: the account's profile colour (stored with or without #), else Studio purple. */
export function brandCoverColor(color?: string | null): string {
  const c = String(color ?? '').trim();
  if (/^#[0-9a-f]{3,8}$/i.test(c)) return c;
  if (/^[0-9a-f]{6}$/i.test(c)) return `#${c}`;
  return '#6C60FF';
}

// ---- Which picture is the cover ("Brand everywhere", Deepak, 4 Nov 2026) ----
// A campaign with NO chosen cover (last_update_img empty) shows the brand everywhere — preview, owner campaign page,
// shared view, published page, cards — never its first moment photo. The brand is the property's image in the
// property view, else the owner's / author's profile image. Some web API responses already fill last_update_img with
// the owner's profile image (the campaign list: last_update_img ?? user.profile_image), so that counts as no cover.

const present = (v?: string | null): string | null => (typeof v === 'string' && v.trim() ? v : null);

export function campaignCover({ chosen, brand, ownerAvatar }: {
  /** The campaign's own cover (last_update_img): a photo, video or YouTube link. */
  chosen?: string | null;
  /** The brand to show without a cover. */
  brand?: string | null;
  /** The owner's profile image, which the API may have put in last_update_img. */
  ownerAvatar?: string | null;
}): { src: string | null; isBrand: boolean } {
  const c = present(chosen);
  const b = present(brand);
  const avatar = present(ownerAvatar);
  if (c && c !== b && c !== avatar) return { src: c, isBrand: false };
  const shown = b || avatar || c;
  return shown ? { src: shown, isBrand: true } : { src: null, isBrand: false };
}

// Read-only inventory cards bring their own pictures (a car, a product, a Shopify collection).
const INVENTORY_CATEGORIES = ['cars', 'shopify', 'website catalogue'];
function isInventoryCard(memory: any): boolean {
  const cat = String(memory?.category?.name ?? memory?.category ?? '').toLowerCase();
  return !!(memory?.isCars || memory?.isShopify || memory?.isCatalogItem || memory?.is_car || memory?.is_shopify || memory?.is_catalog_item)
    || INVENTORY_CATEGORIES.includes(cat);
}

/** A campaign card's cover (MemoriesPage). `propertyImage`: pass it in the property view. */
export function campaignCardCover(memory: any, { propertyImage }: { propertyImage?: string | null } = {}): { src: string | null; isBrand: boolean } {
  if (isInventoryCard(memory)) {
    const src = present(memory?.last_update_img) || present(memory?.photos?.preview_images?.[0]?.url) || present(memory?.thumbnail) || present(propertyImage);
    return { src, isBrand: false };
  }
  const avatar = present(memory?.author?.avatar);
  return campaignCover({ chosen: memory?.last_update_img, brand: present(propertyImage) || avatar, ownerAvatar: avatar });
}
