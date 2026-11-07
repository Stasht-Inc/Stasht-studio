import React, { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { brandCoverColor, campaignCoverLayout, coverCenterTop, isVectorImage, lightCoverFill, type CoverSize } from '../../utils/campaignCover';
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
 * payloads): a LOGO is drawn whole — never cut to a circle — on ONE SOLID colour taken from it (no blurred copy; a logo
 * box blends into its cover; a logo on white is drawn as a rounded card); the owner's PHOTO avatar fills the cover like
 * a chosen photo. Not known (yet): the 4 Nov look, painted at once — no waiting.
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
   *  in big grids). A brand whose pixels could be read always gets its solid colour instead (Chris, 7 Nov 2026). */
  backdrop?: 'blur' | 'color';
  /** Where the middle of a contained picture sits, as a share of the box height (default COVER_CENTER_Y). For a
   *  layout whose title sits higher than usual. */
  centerY?: number;
  /** Judge "too small" against this box instead of the cover's own (campaignCoverLayout's judgeBox). */
  judgeBox?: CoverSize | null;
  /** How far up from the bottom the caller's white text reaches (px), so a light fill's scrim covers all of it.
   *  Default: the lower 56% of the box. */
  textHeight?: number;
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
  src, alt = '', isFallback = false, color, className = '', fallback, onError, loading, backdrop = 'blur', centerY, judgeBox, brandFraction, textHeight,
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
  const layout = campaignCoverLayout({ isFallback, brandKind: brand?.kind ?? null, natural, box, vector: isVectorImage(src), judgeBox, brandFraction: brand?.kind === 'logo' ? brandFraction : undefined });
  const contain = layout.mode === 'contain';
  const pending = layout.mode === 'pending';
  // A judged brand sits on one solid colour: the API's, else the profile colour (then Studio purple). A logo box blends
  // into it (no shadow); a logo on white is a rounded card; a (tiny) photo is a rounded picture.
  const solid = isFallback && !!brand;
  const fill = solid ? (brand.color ?? brandCoverColor(color)) : brandCoverColor(color);
  // A 'whole' picture (the API was unsure: a flat backdrop) is drawn plain too, its backdrop running on into the fill.
  const blendedLogo = solid && ((brand.kind === 'logo' && !brand.frame) || brand.kind === 'whole');
  // On a light fill the callers' bottom gradient isn't enough for their white title / meta: darken the lower part.
  const titleScrim = contain && solid && lightCoverFill(fill);
  const mainClass = layout.mode !== 'contain'
    ? `w-full h-full object-cover${pending ? ' opacity-0' : ''}`
    : `absolute left-1/2 -translate-x-1/2 -translate-y-1/2 ${
      layout.shape === 'circle'
        ? 'rounded-full object-cover border-4 border-white/60 shadow-lg'
        : blendedLogo ? 'object-contain'
          : isFallback && !solid ? 'object-contain drop-shadow-lg' : 'rounded-xl object-contain shadow-lg'
    }`;

  return (
    <div
      ref={boxRef}
      className={`${/\b(absolute|fixed|relative|sticky)\b/.test(className) ? '' : 'relative '}overflow-hidden ${className}`}
      style={contain || (pending && isFallback) ? { backgroundColor: fill } : undefined}
      data-cover-mode={pending ? 'pending' : contain ? (isFallback ? 'brand' : 'small') : 'cover'}
      data-cover-shape={contain ? layout.shape : undefined}
      data-brand-kind={isFallback && brand ? brand.kind : undefined}
      data-cover-fill={contain && solid ? fill : undefined}
      data-brand-frame={contain && solid && brand.frame ? 'true' : undefined}
      data-title-scrim={titleScrim ? 'true' : undefined}
    >
      {contain && backdrop === 'blur' && !solid && (
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
          ? { width: layout.width, height: layout.height, top: coverCenterTop(box.height, layout.height, centerY) }
          : undefined}
      />
      {titleScrim && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: textHeight && box
            // at least 56% black from just above the text down (white text then reads at 4.5:1 on any light fill)
            ? `linear-gradient(to bottom, rgba(0,0,0,0) ${Math.max(0, box.height - textHeight - 70)}px, rgba(0,0,0,0.56) ${Math.max(0, box.height - textHeight - 8)}px, rgba(0,0,0,0.64) 100%)`
            : 'linear-gradient(to bottom, rgba(0,0,0,0) 22%, rgba(0,0,0,0.5) 44%, rgba(0,0,0,0.62) 100%)' }}
        />
      )}
    </div>
  );
}
