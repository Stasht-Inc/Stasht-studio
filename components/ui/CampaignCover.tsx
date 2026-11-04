import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { brandCoverColor, campaignCoverLayout, coverCenterTop, COVER_CENTER_Y, type CoverSize } from '../../utils/campaignCover';

/**
 * A campaign's cover picture (Chris, 4 Nov 2026) — campaign page header, campaign cards, published page and the
 * Create Campaign preview all use this, so they look the same.
 *
 * Real photos fill the box (object-cover), exactly as before. The brand default (the account / property avatar shown
 * when a campaign has no cover) is shown as the round avatar, centred, at a limited size over a blurred copy of itself
 * on the profile colour — never stretched full-bleed. Any other picture too small for its box is shown whole the same
 * way. Layout rules: utils/campaignCover.ts.
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

export default function CampaignCover({
  src, alt = '', isFallback = false, color, className = '', fallback, onError, loading,
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

  const layout = campaignCoverLayout({ isFallback, natural, box });
  const contain = layout.mode === 'contain';
  const sized = contain && layout.width !== null && layout.height !== null;
  const mainClass = !contain
    ? 'w-full h-full object-cover'
    : `absolute left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-lg ${
      layout.shape === 'circle' ? 'rounded-full object-cover border-4 border-white/60' : 'rounded-xl object-contain'
    } ${sized ? '' : 'w-24 h-24 opacity-0'}`;

  return (
    <div
      ref={boxRef}
      className={`${/\b(absolute|fixed|relative|sticky)\b/.test(className) ? '' : 'relative '}overflow-hidden ${className}`}
      style={contain ? { backgroundColor: brandCoverColor(color) } : undefined}
      data-cover-mode={contain ? (layout.shape === 'circle' ? 'brand' : 'small') : 'cover'}
    >
      {contain && (
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
        style={!contain ? undefined : sized && box
          ? { width: layout.width as number, height: layout.height as number, top: coverCenterTop(box.height, layout.height as number) }
          : { top: `${COVER_CENTER_Y * 100}%` }}
      />
    </div>
  );
}
