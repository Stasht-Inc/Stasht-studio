// How a campaign cover picture is laid out in its box (Chris, 4 Nov 2026). Pure, so `node --test` loads it.
//
// A campaign with no cover of its own shows the brand — the account / property avatar — and that small logo used to
// be stretched full-bleed (object-cover), hugely zoomed and pixelated. Now:
//  - the brand default is always shown as the round avatar (the way the avatar shows everywhere in Studio), centred,
//    at most 60% of the box and never enlarged past 1.5x its own size, over a blurred copy of itself;
//  - any other picture that would have to be enlarged noticeably to fill the box is shown whole, centred, the same way;
//  - real photos big enough for the box stay full-bleed, exactly as before.

export interface CoverSize { width: number; height: number }

export type CampaignCoverLayout =
  | { mode: 'cover' }
  | { mode: 'contain'; shape: 'circle' | 'rect'; width: number | null; height: number | null };

/** The brand avatar is at most this share of the box's short side. */
export const BRAND_COVER_FRACTION = 0.6;
/** A too-small picture is at most this share of the box (it is a photo, so it gets a little more room). */
export const SMALL_COVER_FRACTION = 0.8;
/** Never enlarge a picture past this many times its own size. */
export const COVER_MAX_UPSCALE = 1.5;
/** Full-bleed is kept while it needs at most this much enlarging (a barely-small photo still looks fine). */
export const COVER_LOW_RES_UPSCALE = 1.25;
/** A contained picture sits a little above the middle: covers carry their title, pills and buttons at the bottom. */
export const COVER_CENTER_Y = 0.38;
/** Gap kept between a contained picture and the top / bottom of its box. */
const COVER_EDGE_GAP = 12;

/** Where the middle of a contained picture goes (px from the top of the box), kept inside the box. */
export function coverCenterTop(boxHeight: number, pictureHeight: number): number {
  const wanted = boxHeight * COVER_CENTER_Y;
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

export function campaignCoverLayout({ isFallback = false, natural = null, box = null }: {
  /** The picture is the brand default (account / property avatar), not a cover someone chose. */
  isFallback?: boolean;
  /** The picture's own size (naturalWidth / naturalHeight), once it has loaded. */
  natural?: CoverSize | null;
  /** The box it is shown in, in CSS pixels. */
  box?: CoverSize | null;
}): CampaignCoverLayout {
  if (isFallback) {
    if (!known(natural) || !known(box)) return { mode: 'contain', shape: 'circle', width: null, height: null };
    const side = Math.round(Math.min(
      BRAND_COVER_FRACTION * Math.min(box.width, box.height),
      COVER_MAX_UPSCALE * Math.min(natural.width, natural.height),
    ));
    return { mode: 'contain', shape: 'circle', width: side, height: side };
  }
  if (!known(natural) || !known(box)) return { mode: 'cover' };
  const fillScale = Math.max(box.width / natural.width, box.height / natural.height);
  if (fillScale <= COVER_LOW_RES_UPSCALE) return { mode: 'cover' };
  const scale = Math.min(
    (SMALL_COVER_FRACTION * box.width) / natural.width,
    (SMALL_COVER_FRACTION * box.height) / natural.height,
    COVER_MAX_UPSCALE,
  );
  return { mode: 'contain', shape: 'rect', width: Math.round(natural.width * scale), height: Math.round(natural.height * scale) };
}

/** The colour behind a contained cover: the account's profile colour (stored with or without #), else Studio purple. */
export function brandCoverColor(color?: string | null): string {
  const c = String(color ?? '').trim();
  if (/^#[0-9a-f]{3,8}$/i.test(c)) return c;
  if (/^[0-9a-f]{6}$/i.test(c)) return `#${c}`;
  return '#6C60FF';
}
