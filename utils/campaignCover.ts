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
/** Never enlarge a picture past this many times its own size. */
export const COVER_MAX_UPSCALE = 1.5;
/** A chosen picture counts as too small only when it is under this share of the box on a side. */
export const COVER_SMALL_SIDE = 0.5;
/** The brand is cut to a circle only when it is about square (width / height in this range). */
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

export function campaignCoverLayout({ isFallback = false, brandKind = null, natural = null, box = null, vector = false, judgeBox = null }: {
  /** The picture is the brand default (account / property avatar), not a cover someone chose. */
  isFallback?: boolean;
  /** What the brand picture is (utils/brandPicture, Chris 7 Nov 2026): a 'photo' (the owner's selfie avatar) fills the
   *  cover like a chosen photo; a 'logo' — or not known (null) — is drawn whole as below. */
  brandKind?: 'logo' | 'photo' | null;
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
  if (isFallback && brandKind !== 'photo') {
    if (!known(box)) return { mode: 'pending' };
    if (vector) {
      return { mode: 'contain', shape: 'rect', width: Math.round(BRAND_COVER_FRACTION * box.width), height: Math.round(BRAND_COVER_FRACTION * box.height) };
    }
    if (!known(natural)) return { mode: 'pending' };
    const aspect = natural.width / natural.height;
    if (aspect >= BRAND_CIRCLE_ASPECT[0] && aspect <= BRAND_CIRCLE_ASPECT[1]) {
      const side = Math.round(Math.min(
        BRAND_COVER_FRACTION * Math.min(box.width, box.height),
        COVER_MAX_UPSCALE * Math.min(natural.width, natural.height),
      ));
      return { mode: 'contain', shape: 'circle', width: side, height: side };
    }
    return containRect(natural, box, BRAND_COVER_FRACTION);
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
