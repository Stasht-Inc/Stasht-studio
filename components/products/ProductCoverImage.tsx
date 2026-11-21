// components/products/ProductCoverImage.tsx — a product's cover on a card or picker row (Chris 21 Nov 2026, P11: "the
// card must show the same cover as the product page"). An intro video that is the cover (cover_video) shows its first
// frame with the campaign cards' own VideoThumbnail (MemoryCard); else the main photo; else / on a broken file `fallback`
// (the account's brand, as before).
import { useState, type ReactNode } from 'react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { VideoThumbnail } from '../MemoryCard';

export default function ProductCoverImage({ coverVideo, mainImage, alt, className = 'h-full w-full object-cover', fallback }: {
  coverVideo?: string | null; mainImage?: string | null; alt: string; className?: string; fallback: ReactNode;
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  if (coverVideo && !videoFailed) {
    return <div data-testid="product-cover-video" className="h-full w-full"><VideoThumbnail src={coverVideo} className={className} onFail={() => setVideoFailed(true)} /></div>;
  }
  if (mainImage) return <ImageWithFallback src={mainImage} alt={alt} className={className} fallback={fallback} />;
  return <>{fallback}</>;
}
