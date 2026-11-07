import React, { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { brandCoverColor, campaignCoverLayout, COVER_MAX_UPSCALE, coverCenterTop, fitInArea, isVectorImage, lightCoverFill, seamlessFill, type CoverSize } from '../../utils/campaignCover';
import { knownBrandPicture, requestBrandPicture, subscribeBrandPictures, type BrandPicture } from '../../utils/brandPictures';

/**
 * A campaign's cover picture (Chris, 4 Nov 2026) — campaign page header, campaign cards, published page and the
 * Create Campaign preview all use this, so they look the same.
 *
 * Real photos fill the box (object-cover), exactly as before. The brand default (the account / property avatar shown
 * when a campaign has no cover) is centred at a limited size over a backdrop (a blurred copy of itself on the profile
 * colour, or just the colour) — the round avatar when the logo is square, the whole logo when it isn't — never
 * stretched full-bleed. A chosen picture far too small for its box is shown whole the same way. A raster picture stays
 * hidden until its size is known, so it never shows stretched for a frame. Layout rules: utils/campaignCover.ts.
 *
 * Chris, 7 Nov 2026: the web API judges the brand picture once (utils/brandPictures; it comes with the campaign
 * payloads): a LOGO is drawn whole — never cut round, no ring, card, shadow or blurred copy — on the logo image's OWN
 * background colour (or its top-to-bottom gradient), so logo and cover read as one surface (Chris point 11:
 * "seamless"); the owner's PHOTO avatar fills the cover like a chosen photo; 'whole' (unsure) is drawn full height on
 * its edge colour. Not known (yet): the brand drawn whole and plain on white, painted at once — no waiting.
 *
 * The wrapper takes `className` (size / position, e.g. "w-full h-full" or "absolute inset-0"); overlays (gradient,
 * title, buttons) stay with the caller, on top of it.
 */
export interface CampaignCoverProps {
  src?: string | null;
  alt?: string;
  /** The picture is the brand default (account / property avatar), not a cover someone chose. */
  isFallback?: boolean;
  /** Profile colour behind a contained picture (with or without #). */
  color?: string | null;
  className?: string;
  /** Shown when there is no picture or it fails to load. Default: the profile colour. */
  fallback?: React.ReactNode;
  onError?: () => void;
  loading?: 'lazy' | 'eager';
  /** Behind a contained picture: a blurred copy of it (headers, preview) or just the profile colour (cards — cheaper
   *  in big grids) — for a small CHOSEN picture only: a brand is always drawn plain on its own background (Chris 7 Nov). */
  backdrop?: 'blur' | 'color';
  /** Where the middle of a contained picture sits, as a share of the box height (default COVER_CENTER_Y). For a
   *  layout whose title sits higher than usual. */
  centerY?: number;
  /** Judge "too small" against this box instead of the cover's own (campaignCoverLayout's judgeBox). */
  judgeBox?: CoverSize | null;
  /** How far up from the bottom the caller's white text reaches (px), so a light fill's scrim covers all of it.
   *  Default: the lower 56% of the box. */
  textHeight?: number;
  /** Cards: the free area (px from the box's top) between the top pills and the title. A brand drawn whole is fitted
   *  and centred in it, never behind the title or its scrim. */
  fitArea?: { top: number; bottom: number; left?: number; right?: number } | null;
  /** A judged logo's largest share of the box (campaignCoverLayout's brandFraction); not judged: the 4 Nov size. */
  brandFraction?: number;
}

// One ResizeObserver for every cover on the page (a campaign grid can have hundreds of cards).
const sizeListeners = new WeakMap<Element, (size: CoverSize) => void>();
let sharedObserver: ResizeObserver | null = null;
function observeSize(el: Element, listener: (size: CoverSize) => void): () => void {
  if (typeof ResizeObserver === 'undefined') {
    const r = el.getBoundingClientRect();
    listener({ width: r.width, height: r.height });
    return () => {};
  }
  if (!sharedObserver) {
    sharedObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        sizeListeners.get(entry.target)?.({ width, height });
      }
    });
  }
  sizeListeners.set(el, listener);
  sharedObserver.observe(el);
  return () => {
    sizeListeners.delete(el);
    sharedObserver?.unobserve(el);
  };
}

/** Behind a brand not judged yet (or never judgeable, e.g. SVG): white — most logos sit on white (Chris point 11). */
const NEUTRAL_FILL = '#FFFFFF';

/** The web API's answer for the brand picture (null / undefined: not known — the 4 Nov look). Asks once if needed. */
function useBrandPicture(src: string | null): BrandPicture | null | undefined {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const pic = src ? knownBrandPicture(src) : undefined;
  useEffect(() => {
    if (!src) return undefined;
    if (knownBrandPicture(src) !== undefined) {
      // Arrived between this render and the effect (re-review N7): show it now.
      if (pic === undefined) rerender();
      return undefined;
    }
    const off = subscribeBrandPictures(() => { if (knownBrandPicture(src) !== undefined) rerender(); });
    requestBrandPicture(src);
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  return pic;
}

export default function CampaignCover({
  src, alt = '', isFallback = false, color, className = '', fallback, onError, loading, backdrop = 'blur', centerY, judgeBox, brandFraction, textHeight, fitArea,
}: CampaignCoverProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // Both are kept with the picture they belong to, so a new src starts clean.
  const [loaded, setLoaded] = useState<{ src: string; size: CoverSize } | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [box, setBox] = useState<CoverSize | null>(null);
  const empty = !src || !String(src).trim();
  const failed = !empty && failedSrc === src;
  const showImage = !empty && !failed;
  const natural = loaded && loaded.src === src ? loaded.size : null;
  const brand = useBrandPicture(isFallback && !empty ? String(src) : null);
  const setNatural = (img: HTMLImageElement) => {
    if (img.naturalWidth > 0 && src) setLoaded({ src, size: { width: img.naturalWidth, height: img.naturalHeight } });
  };

  useEffect(() => {
    const el = boxRef.current;
    if (!showImage || !el) return undefined;
    return observeSize(el, (size) => setBox((prev) => (
      prev && Math.round(prev.width) === Math.round(size.width) && Math.round(prev.height) === Math.round(size.height) ? prev : size
    )));
  }, [showImage]);

  // A cached picture can finish loading before React listens for it.
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) setNatural(img);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, showImage]);

  if (!showImage) {
    return fallback !== undefined && fallback !== null
      ? <>{fallback}</>
      : <div className={className} style={{ backgroundColor: brandCoverColor(color) }} />;
  }

  // An SVG never goes blurry when enlarged (and may report no size): never "too small", the brand sized by the box.
  const base = campaignCoverLayout({ isFallback, brandKind: brand?.kind ?? null, natural, box, vector: isVectorImage(src), judgeBox, brandFraction: brand?.kind === 'logo' ? brandFraction : undefined });
  // A card's logo (or a brand not judged yet) goes in the free area above the title, so it never sits behind the title
  // text or its scrim; a card too cramped for any (the text fills it) shows just the seamless fill. A 'whole' picture
  // keeps its full height (it may be a headshot: never shrunk).
  const fitsArea = base.mode === 'contain' && isFallback && (brand?.kind === 'logo' || !brand) && !!fitArea && !!box && !!natural;
  const fitted = fitsArea ? fitInArea(natural as CoverSize, box as CoverSize, fitArea as { top: number; bottom: number; left?: number; right?: number }, COVER_MAX_UPSCALE) : null;
  const brandHidden = fitsArea && !fitted;
  const layout = fitted && base.mode === 'contain' ? { ...base, width: fitted.width, height: fitted.height } : base;
  const contain = layout.mode === 'contain';
  const pending = layout.mode === 'pending';
  // The brand drawn whole is PLAIN (Chris point 11): a logo, a 'whole' picture, or one not judged yet — no circle,
  // ring, card, shadow or blurred copy. Its fill: the logo image's own background (the API's answer), else white.
  const plainBrand = isFallback && brand?.kind !== 'photo';
  const fill = !isFallback ? brandCoverColor(color) : brand ? (brand.color ?? brandCoverColor(color)) : NEUTRAL_FILL;
  const imageTop = fitted ? fitted.centerTop : contain && box ? coverCenterTop(box.height, layout.height, centerY) : 0;
  const gradient = contain && plainBrand && brand?.gradient && box
    ? seamlessFill(brand, { top: imageTop - layout.height / 2, height: layout.height }, fill)
    : null;
  // On a light fill the callers' bottom gradient isn't enough for their white title / meta: darken the lower part.
  const titleScrim = contain && isFallback && lightCoverFill(brand?.gradient ? brand.gradient[1] : fill);
  const mainClass = layout.mode !== 'contain'
    ? `w-full h-full object-cover${pending ? ' opacity-0' : ''}`
    : `absolute left-1/2 -translate-x-1/2 -translate-y-1/2 ${plainBrand ? 'object-contain' : 'rounded-xl object-contain shadow-lg'}${brandHidden ? ' opacity-0' : ''}`;

  return (
    <div
      ref={boxRef}
      className={`${/\b(absolute|fixed|relative|sticky)\b/.test(className) ? '' : 'relative '}overflow-hidden ${className}`}
      style={gradient ? { background: gradient } : contain || (pending && isFallback) ? { backgroundColor: fill } : undefined}
      data-cover-mode={pending ? 'pending' : contain ? (isFallback ? 'brand' : 'small') : 'cover'}
      data-cover-shape={contain ? layout.shape : undefined}
      data-brand-kind={isFallback && brand ? brand.kind : undefined}
      data-cover-fill={contain && isFallback ? fill : undefined}
      data-cover-gradient={gradient && brand?.gradient ? brand.gradient.join(' ') : undefined}
      data-title-scrim={titleScrim ? 'true' : undefined}
      data-brand-hidden={brandHidden ? 'true' : undefined}
    >
      {contain && backdrop === 'blur' && !isFallback && (
        <img
          src={src as string}
          alt=""
          aria-hidden="true"
          loading={loading}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-70 pointer-events-none"
        />
      )}
      <img
        ref={imgRef}
        src={src as string}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={(e) => setNatural(e.currentTarget)}
        onError={() => { setFailedSrc(src ?? null); onError?.(); }}
        className={mainClass}
        style={layout.mode === 'contain' && box
          ? { width: layout.width, height: layout.height, top: imageTop, ...(fitted ? { left: fitted.centerLeft } : {}) }
          : undefined}
      />
      {titleScrim && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: textHeight && box
            // at least 56% black from just above the text down (white text then reads at 4.5:1 on any light fill);
            // a fitted card brand stays clear of it (the ramp starts below the brand)
            ? `linear-gradient(to bottom, rgba(0,0,0,0) ${Math.max(0, fitted ? Math.min(fitted.centerTop + fitted.height / 2, box.height - textHeight - 8) : box.height - textHeight - 70)}px, rgba(0,0,0,0.56) ${Math.max(0, box.height - textHeight - 8)}px, rgba(0,0,0,0.64) 100%)`
            : 'linear-gradient(to bottom, rgba(0,0,0,0) 22%, rgba(0,0,0,0.5) 44%, rgba(0,0,0,0.62) 100%)' }}
        />
      )}
    </div>
  );
}
