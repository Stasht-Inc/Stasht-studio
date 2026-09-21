import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Calendar, MapPin, MessageSquare, ArrowLeft, Clock, Lock, Circle, X, ChevronLeft, ChevronRight, Send, Link, Facebook, Linkedin, Code, Eye, Globe, ChevronDown, Download, Mail, FileText, Heart, Search, Play, Pause, Phone, Share2, Copy, MoreVertical, BookOpen, ArrowRight, ExternalLink, ShoppingCart, Star, Gift, Pointer, Quote, Plus, Upload, Loader2, Camera, Image as ImageIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Card } from "../components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../components/ui/hover-card";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from "../components/ui/popover";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { PdfThumbnail } from "../components/PdfThumbnail";
import MemoryCard from "../components/MemoryCard";
import { isCarCampaign } from "../utils/memoryUtils";
import { displayWebsite } from "../utils/displayUrl";
import RequestMomentModal from "../components/RequestMomentModal";
import CarPhotoViewer from '../components/CarPhotoViewer';
import { toast, Toaster } from "sonner";
import exifr from "exifr";
import { dashboardAPI } from "../utils/authUtils";
import { useAuth } from "../contexts/AuthContext";
import { useStoreelTracking } from "../hooks/useStoreelTracking";

// Custom Comment Icon Component (for mobile)
const CommentIcon = ({ className = "" }: { className?: string }) => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 22 22"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M7.70919 17.862C9.37851 18.7184 11.2988 18.9503 13.124 18.5161C14.9492 18.0818 16.5593 17.01 17.6641 15.4937C18.7689 13.9774 19.2959 12.1163 19.15 10.2458C19.004 8.37538 18.1949 6.61855 16.8682 5.29192C15.5416 3.96529 13.7848 3.1561 11.9143 3.01018C10.0439 2.86426 8.18278 3.3912 6.66647 4.49605C5.15015 5.60089 4.0783 7.21098 3.64407 9.03617C3.20984 10.8614 3.44178 12.7816 4.2981 14.451L2.54883 19.6113L7.70919 17.862Z"
      stroke="currentColor"
      strokeWidth="1.74928"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ── Widget rendering (html / youtube / quote / cta) for the published page ──
// Mirrors the widget markup used in the Studio (MemoryDetailsPage) so the public
// view matches what the owner sees while composing.
const PUB_CTA_ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties; className?: string }>> = {
  ArrowRight, ExternalLink, Link, ShoppingCart, Phone, Mail, Calendar, Download, Play, Heart, Star, Gift, MapPin, Send, Upload,
};
// Fixed icon for a "Share Request a Moment" CTA (mode === 'request_moment').
const PUB_CTA_REQUEST_MOMENT_ICON = 'Upload';
const PUB_CTA_DEFAULT_BUTTON_COLOR = '#6C60FF';
const PUB_CTA_DEFAULT_TEXT_COLOR = '#FFFFFF';
const PUB_CTA_DEFAULT_ICON_SIZE = 18;
const PUB_CTA_DEFAULT_FONT_SIZE = 16;
const PUB_CTA_DEFAULT_BORDER_RADIUS = 12;

// Ensure a CTA link has a scheme so the anchor navigates to an absolute address
function pubNormalizeUrl(url: string): string {
  const u = (url || '').trim();
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

// Renders a single widget by its widget_type. `widget` is the raw API object
// ({ id, widget_type, widget_data, ... }). memoryId is used for CTA click tracking.
function PublishedWidget({ widget, memoryId, onRequestMoment, onCtaClick }: {
  widget: any;
  memoryId?: string | number | null;
  // Invoked by a CTA saved with mode 'request_moment'; opens the submission form.
  onRequestMoment?: (afterPostId: string | null) => void;
  // Storeel viewer beacon (spec §5.4 cta_clicked) — separate from the legacy
  // dashboardAPI.trackWidgetClick() call below, which only powers the
  // Studio-side widget click_count, not Storeel measurement.
  onCtaClick?: (widgetId?: number | string) => void;
}) {
  const data = widget?.widget_data || {};
  switch (widget?.widget_type) {
    case 'html':
      return (
        <div className="rounded-2xl bg-white p-4 border border-gray-100">
          <div className="[&_h1]:text-2xl [&_h1]:font-bold [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-[#6C60FF] [&_a]:underline [&_strong]:font-bold" dangerouslySetInnerHTML={{ __html: data.content || '' }} />
        </div>
      );
    case 'youtube':
      if (!data.videoId) return null;
      return (
        <div className="rounded-2xl bg-white p-4 border border-gray-100">
          <iframe width="100%" height="200" src={`https://www.youtube.com/embed/${data.videoId}?autoplay=0`} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="rounded-lg" />
        </div>
      );
    case 'quote':
      return (
        <div className="rounded-2xl bg-[#F0EEFF] p-5 border border-gray-100 border-l-4 border-l-[#6C60FF]">
          <p className="text-lg font-bold text-gray-800 text-center leading-relaxed break-words">{data.text || ''}</p>
          {data.author && <p className="text-sm text-gray-500 text-center mt-2">— {data.author}</p>}
        </div>
      );
    case 'cta': {
      // A CTA authored as "Share Request a Moment" opens the submission form
      // instead of navigating; its icon is fixed rather than author-chosen.
      const isRequestMoment = data.mode === 'request_moment';
      const iconKey = isRequestMoment ? PUB_CTA_REQUEST_MOMENT_ICON : data.icon;
      const Icon = iconKey ? PUB_CTA_ICONS[iconKey] : undefined;
      const iconSize = data.iconSize || PUB_CTA_DEFAULT_ICON_SIZE;
      const href = pubNormalizeUrl(data.buttonLink || '');
      const buttonWidth = data.buttonWidth || 0; // 0 = full width
      const trackClick = () => {
        onCtaClick?.(widget?.id);
        const mid = widget?.memory_id ?? memoryId;
        if (!mid || !widget?.id) return;
        try { dashboardAPI.trackWidgetClick(String(mid), String(widget.id)).catch(() => {}); } catch { /* ignore */ }
      };
      const ctaButtonStyle: React.CSSProperties = {
        backgroundColor: data.buttonColor || PUB_CTA_DEFAULT_BUTTON_COLOR,
        color: data.textColor || PUB_CTA_DEFAULT_TEXT_COLOR,
        fontSize: data.fontSize || PUB_CTA_DEFAULT_FONT_SIZE,
        borderRadius: `${data.borderRadius ?? PUB_CTA_DEFAULT_BORDER_RADIUS}px`,
        width: buttonWidth ? `${buttonWidth}px` : '100%',
        maxWidth: '100%',
      };
      return (
        <div className="relative rounded-2xl bg-white p-6 flex flex-col items-center text-center gap-4 border border-gray-100">
          {data.title && <h3 className="text-xl font-bold text-gray-900 break-words">{data.title}</h3>}
          {isRequestMoment ? (
            <button
              type="button"
              onClick={() => {
                trackClick();
                const after = widget?.after_post_id;
                onRequestMoment?.(after === null || after === undefined || after === '' || after === 0 || after === '0' ? null : String(after));
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold transition-opacity hover:opacity-90"
              style={ctaButtonStyle}
            >
              {Icon && <Icon style={{ width: iconSize, height: iconSize }} />}
              <span>{data.buttonText || 'Share a Moment'}</span>
            </button>
          ) : (
            <a
              href={href || undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { if (!href) e.preventDefault(); trackClick(); }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold transition-opacity hover:opacity-90 no-underline"
              style={ctaButtonStyle}
            >
              {Icon && <Icon style={{ width: iconSize, height: iconSize }} />}
              <span>{data.buttonText || 'Learn More'}</span>
            </a>
          )}
        </div>
      );
    }
    case 'product': {
      // Shopify product card. widget_data holds a snapshot synced from Shopify plus the
      // product_url (built from shop_domain + handle) so "Buy Now" routes to Shopify.
      const productUrl = data.product_url
        || (data.shop_domain && data.handle ? `https://${data.shop_domain}/products/${data.handle}` : '');
      const priceLabel = data.price ? (data.currency ? `${data.currency} ${data.price}` : String(data.price)) : '';
      const shortDesc = (data.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const trackClick = () => {
        onCtaClick?.(widget?.id);
        const mid = widget?.memory_id ?? memoryId;
        if (!mid || !widget?.id) return;
        try { dashboardAPI.trackWidgetClick(String(mid), String(widget.id)).catch(() => {}); } catch { /* ignore */ }
      };
      return (
        <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
          {data.image && (
            <div className="aspect-square bg-gray-100">
              <ImageWithFallback src={data.image} alt={data.title || 'Product'} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-4 space-y-2">
            {data.title && <h3 className="text-lg font-bold text-gray-900 break-words">{data.title}</h3>}
            {priceLabel && <p className="text-base font-semibold text-[#6C60FF]">{priceLabel}</p>}
            {shortDesc && <p className="text-sm text-gray-600 line-clamp-2">{shortDesc}</p>}
            <a
              href={productUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { if (!productUrl) e.preventDefault(); trackClick(); }}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 px-6 py-3 font-semibold text-white bg-[#6C60FF] rounded-xl transition-opacity hover:opacity-90 no-underline"
            >
              <ShoppingCart className="w-[18px] h-[18px]" />
              <span>Buy Now</span>
            </a>
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

// Post Card Component with Carousel for sub-images
interface PublishedPostCardProps {
  post: any;
  index: number;
  memoryData: any;
  onImageClick: (post: any, index: number) => void;
  onCommentClick?: (post: any, index: number) => void;
}

const isVideoUrl = (url: string): boolean => {
  if (!url) return false;
  // Includes the raw-MIME-subtype extensions (.quicktime, .x-msvideo, etc.) that
  // some iPhone/.mov uploads still carry from a since-fixed backend naming bug
  // (ClickUp wdy2xgympv) — without these, those files render as a plain image
  // with no play button. Keep this list in sync with the mobile app's
  // _isVideoFile() in stasht-app-2026/lib/new_development/stories/story_detail_cover.dart.
  const videoExtensions = [
    '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm', '.3gp', '.m4v',
    '.mts', '.m2ts', '.quicktime', '.x-msvideo', '.x-matroska', '.x-ms-wmv', '.3gpp',
  ];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
};

const isYoutubeUrl = (url: string): boolean => {
  if (!url) return false;
  return /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\//.test(url);
};

const getYoutubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
  return watchMatch?.[1] || shortMatch?.[1] || shortsMatch?.[1] || embedMatch?.[1] || null;
};

// A linked memory that is actually a car listing (lm.is_car) carries make/model/year/price/
// mileage/stock_number instead of tags/sub_category, so its card needs its own label/tags.
const carLinkedMemoryLabel = (lm: any): string => {
  const price = typeof lm?.price === 'string' ? parseFloat(lm.price) : lm?.price;
  return Number.isFinite(price) ? `$${price.toLocaleString()}` : '';
};
const carLinkedMemoryTags = (lm: any): string[] => {
  const tags: string[] = [];
  if (lm?.mileage != null && lm.mileage !== '') tags.push(`${Number(lm.mileage).toLocaleString()} mi`);
  if (lm?.stock_number) tags.push(`Stock #${lm.stock_number}`);
  return tags;
};
// eDealer CDN encodes the image size as the first path segment
// (https://images.edealer.ca/{sizeId}/{id}.jpeg). Car galleries stored the tiny
// thumbnail preset (e.g. /21/ ≈ 2.6 KB), so large displays looked like thumbnails.
// Rewrite to the full-res preset (/1/ ≈ 83 KB). Non-eDealer URLs pass through.
const carImageLarge = (url: string): string =>
  typeof url === 'string'
    ? url.replace(/^(https?:\/\/images\.edealer\.ca)\/\d+\//i, '$1/1/')
    : url;

function PublishedPostCard({ post, index, memoryData, onImageClick, onCommentClick }: PublishedPostCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Build array of all images (main + sub-images)
  const allImages: { src: string; id: string }[] = [
    { src: post.image_link || post.master_image_link, id: post.id }
  ];

  if (post.sub_images && Array.isArray(post.sub_images) && post.sub_images.length > 0) {
    post.sub_images.forEach((subImg: any) => {
      allImages.push({
        src: subImg.image_link || subImg.master_image_link || subImg.src,
        id: subImg.id
      });
    });
  }

  const hasMultipleImages = allImages.length > 1;
  const currentImage = allImages[currentImageIndex];

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-200 h-auto">
      {/* Post Image with Carousel */}
      <div
        className="relative aspect-[4/5] bg-gray-100 cursor-pointer group rounded-t-2xl overflow-hidden"
        onClick={() => onImageClick(post, index)}
      >
        {currentImage?.src?.toLowerCase().endsWith('.svg') ? (
          (post.user?.profile_image || memoryData.user?.profile_image) ? (
            <img
              src={post.user?.profile_image || memoryData.user?.profile_image}
              className="w-full h-full object-cover"
              alt={post.user?.name || memoryData.user?.name || 'User'}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#6C60FF] to-purple-600">
              <span className="text-white font-bold" style={{ fontSize: '80px' }}>
                {(post.user?.name || memoryData.user?.name)?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'}
              </span>
            </div>
          )
        ) : (
          <ImageWithFallback
            src={currentImage?.src}
            alt={post.name || 'Moment'}
            className="w-full h-full object-cover"
            fallback={
              (post.user?.profile_image || memoryData.user?.profile_image) ? (
                <img
                  src={post.user?.profile_image || memoryData.user?.profile_image}
                  className="w-full h-full object-cover"
                  alt={post.user?.name || memoryData.user?.name || 'User'}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#6C60FF] to-purple-600">
                  <span className="text-white font-bold" style={{ fontSize: '80px' }}>
                    {(post.user?.name || memoryData.user?.name)?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'}
                  </span>
                </div>
              )
            }
          />
        )}

        {/* Carousel Counter */}
        {hasMultipleImages && (
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded-full">
            {currentImageIndex + 1}/{allImages.length}
          </div>
        )}

        {/* Carousel Navigation Arrows */}
        {hasMultipleImages && (
          <>
            <button
              onClick={handlePrevImage}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white text-gray-700 flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors border border-gray-100"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNextImage}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white text-gray-700 flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors border border-gray-100"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Post Content */}
      <div className={`px-4 pt-4 bg-white ${post.description && post.description.trim() ? 'pb-4' : 'pb-2'}`}>
        {/* Author Info and Comments */}
        <div className={`flex items-center justify-between gap-2 ${(post.location || post.uploaded_at || post.capture_date || post.title) ? 'mb-2' : (post.description && post.description.trim() ? 'mb-3' : 'mb-0')}`}>
          <div className="flex items-center gap-2 flex-1">
            <div className="h-10 w-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-gradient-to-br from-[#6C60FF] to-purple-600 text-white text-sm font-medium relative">
              {post.user?.profile_image && (
                <img
                  src={post.user.profile_image}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <span>{(post.user?.name || memoryData.user?.name)?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'}</span>
            </div>
            <p className="text-base font-medium text-gray-900">
              {post.user?.name || memoryData.user?.name}
            </p>
          </div>
          {/* Comment count on the right */}
          {post.comments_count !== null && post.comments_count !== undefined && (
            <button
              onClick={(e) => { e.stopPropagation(); onCommentClick?.(post, index); }}
              className="flex items-center gap-1.5 text-base text-gray-600 hover:text-[#6C60FF] transition-colors cursor-pointer"
            >
              <MessageSquare className="w-5 h-5" />
              <span>{post.comments_count}</span>
            </button>
          )}
        </div>

        {/* Location and Date - with location icon always showing with date */}
        <div
          className={`flex items-center ${(post.title || (post.description && post.description.trim())) ? 'mb-2' : 'mb-0'}`}
          style={{
            color: '#6A7282',
            fontSize: '14px',
            fontStyle: 'normal',
            fontWeight: 400,
            lineHeight: '20px',
            letterSpacing: '-0.018px'
          }}
        >
          {/* Location on the left (show icon with - if no location) */}
          <div className="flex items-center gap-1.5 flex-1">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{post.location || '-'}</span>
          </div>
          {/* Date on the right */}
          {(post.uploaded_at || post.capture_date) && !isCarCampaign(memoryData) && (
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span className="whitespace-nowrap">{new Date(post.uploaded_at || post.capture_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}</span>
            </div>
          )}
        </div>

        {/* Title - below location */}
        {post.title && (
          <p
            className={`font-medium ${post.description && post.description.trim() ? 'mb-2' : 'mb-0'}`}
            style={{
              color: '#364153',
              fontSize: '16px',
              lineHeight: '24px'
            }}
          >
            {post.title}
          </p>
        )}

        {/* Description */}
        {post.description && post.description.trim() && (
          <p
            className="whitespace-pre-line"
            style={{
              color: '#364153',
              fontSize: '16px',
              fontStyle: 'normal',
              fontWeight: 400,
              lineHeight: '24px',
              letterSpacing: '-0.15px'
            }}
          >
            {post.description}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PublishedMemoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memoryData, setMemoryData] = useState<any>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Get URL parameters
  const viewOnly = searchParams.get('viewonly') === '1';
  const accessToken = searchParams.get('access_token');
  const postIdParam = searchParams.get('post_id'); // Get post_id from URL to auto-open specific post
  // Storeel measurement (spec §5.3/5.4): the tokenised send this visit came
  // from, forwarded by the /share/memory/{slug} redirect. Empty for organic/
  // untracked visits — useStoreelTracking no-ops entirely in that case.
  const storeelSendToken = searchParams.get('s');

  // Image viewer state
  const [imageViewer, setImageViewer] = useState<{
    isOpen: boolean;
    imageId?: string;
    imageSrc: string;
    imageAlt: string;
    currentIndex: number;
    user_name?: string;
    user_profile?: string;
    location?: string;
    uploaded_at?: string;
    capture_date?: string;
    description?: string;
    comments_count?: number;
    comments?: any[];
    sub_images?: any[];
    title?: string;
    isPdf?: boolean;
  }>({
    isOpen: false,
    imageSrc: '',
    imageAlt: '',
    currentIndex: 0,
    comments: []
  });

  // Blob URL for PDF viewer (avoids Content-Disposition: attachment issue)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [combinedPublishedTimeline, setCombinedPublishedTimeline] = useState<Array<{type: 'post'|'linked', id: string}> | null>(null);
  const [activePubLmId, setActivePubLmId] = useState<string | null>(null);
  const [memoryHistory, setMemoryHistory] = useState<any[]>([]);
  // True when this memory is shown inside the embed HTML (iframe) or was opened from an author
  // page — so we can offer a Back button that returns to that page via browser history.
  const [cameFromAuthorPage] = useState<boolean>(() => {
    try {
      const isEmbedded = window.self !== window.top; // inside an iframe (e.g. the embed HTML)
      const fromAuthor = document.referrer.includes('/published-author-memory/');
      return isEmbedded || fromAuthor;
    } catch {
      // Cross-origin window.top access implies we are embedded
      return true;
    }
  });
  const [isLoadingSubMemory, setIsLoadingSubMemory] = useState(false);
  const sortedPostsRef = useRef<any[]>([]);
  useEffect(() => {
    if (!imageViewer.isPdf || !imageViewer.imageSrc) { setPdfBlobUrl(null); return; }
    let objectUrl: string | null = null;
    let cancelled = false;
    async function loadPdf() {
      try {
        const S3_HOST = 'stasht-data.s3.us-east-2.amazonaws.com';
        let fetchUrl = imageViewer.imageSrc;
        try { const u = new URL(imageViewer.imageSrc); if (u.hostname === S3_HOST) fetchUrl = `/s3-proxy${u.pathname}${u.search}`; } catch {}
        const res = await fetch(fetchUrl);
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(`${objectUrl}#toolbar=0&navpanes=0&view=FitH&page=1`);
      } catch {}
    }
    setPdfBlobUrl(null);
    loadPdf();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [imageViewer.isPdf, imageViewer.imageSrc]);

  // Sync combined published timeline using memoryData.posts to avoid TDZ with sortedPosts
  useEffect(() => {
    const linked = (memoryData?.linked_memories || []).map((lm: any) => ({ type: 'linked' as const, id: String(lm.id) }));
    const posts = (memoryData?.posts || [])
      .filter((p: any) => !p.parent_id && p.admin_approval !== 0 && p.admin_approval !== '0')
      .map((p: any) => ({ type: 'post' as const, id: String(p.id) }));
    const allItems = [...linked, ...posts];
    if (allItems.length === 0) return;
    if (Array.isArray(memoryData?.unified_order) && memoryData.unified_order.length > 0) {
      const fromApi = memoryData.unified_order
        .map((entry: any) => ({ type: entry.type === 'linked_memory' ? 'linked' as const : 'post' as const, id: String(entry.id) }))
        .filter((entry: any) => allItems.some(a => a.type === entry.type && a.id === entry.id));
      const missing = allItems.filter(a => !fromApi.some((e: any) => e.type === a.type && e.id === a.id));
      setCombinedPublishedTimeline([...fromApi, ...missing]);
    } else {
      setCombinedPublishedTimeline(prev => {
        if (!prev) return allItems;
        const filtered = prev.filter(item => allItems.some(a => a.type === item.type && a.id === item.id));
        const newItems = allItems.filter(item => !prev.some(p => p.type === item.type && p.id === item.id));
        return [...filtered, ...newItems];
      });
    }
  }, [
    (memoryData?.linked_memories || []).map((lm: any) => lm.id).join(','),
    (memoryData?.posts || []).filter((p: any) => !p.parent_id).map((p: any) => p.id).join(','),
    memoryData?.unified_order
  ]);

  // When scroll hits bottom, activate last combinedPublishedTimeline item
  useEffect(() => {
    const container = rightScrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;
      if (atBottom && combinedPublishedTimeline && combinedPublishedTimeline.length > 0) {
        const last = combinedPublishedTimeline[combinedPublishedTimeline.length - 1];
        if (last.type === 'linked') {
          setActivePubLmId(last.id);
          setActiveMemoryIndex(-1);
        } else {
          const idx = sortedPostsRef.current.findIndex((p: any) => String(p.id) === last.id);
          if (idx !== -1) setActiveMemoryIndex(idx);
        }
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [combinedPublishedTimeline]);

  const handlePdfDocumentView = (doc: { envelope_id: string; document_name: string; status: string; signed_document_url: string }) => {
    setImageViewer({
      isOpen: true,
      imageSrc: doc.signed_document_url,
      imageAlt: doc.document_name,
      title: doc.document_name,
      currentIndex: 0,
      comments: [],
      isPdf: true,
      user_name: memoryData?.user?.name,
      user_profile: memoryData?.user?.profile_image,
      uploaded_at: memoryData?.created_at,
    });
  };

  const handleLinkedMemoryClick = async (lm: any) => {
    // Cars aren't Memory records — they're rows on the memory_cars pivot, so
    // dashboardAPI.getMemoryDetail(lm.id) below would look up a Memory by that id
    // (wrong record, or a 404) instead of the car. Every field the detail view
    // needs is already on the linked_memories entry itself (see
    // PublishedMemoryController::index()'s $carEntries mapping on the backend),
    // so just show it directly with no extra request.
    if (lm.is_car) {
      setCarPhotoIndex(0);
      setSelectedCarDetail(lm);
      return;
    }

    setIsLoadingSubMemory(true);
    try {
      const res = await dashboardAPI.getMemoryDetail(String(lm.id));
      console.log('🔗 memory-detail response:', res);
      if (res.success && res.data) {
        const rawData = res.data?.data || res.data;
        const newMemory = rawData?.memory || rawData;
        console.log('🔗 parsed newMemory keys:', Object.keys(newMemory || {}));
        setMemoryHistory(prev => [...prev, memoryData]);
        setMemoryData({
          ...newMemory,
          linked_memories: newMemory?.linked_memories ?? rawData?.linked_memories ?? [],
          unified_order: newMemory?.unified_order ?? rawData?.unified_order ?? null,
          widgets: newMemory?.widgets ?? rawData?.widgets ?? [],
        });
        setCombinedPublishedTimeline(null);
        setActivePubLmId(null);
        setActiveMemoryIndex(0);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        toast.error('Failed to load campaign');
      }
    } catch {
      toast.error('Failed to load campaign');
    }
    setIsLoadingSubMemory(false);
  };

  const handleBackToCampaigns = () => {
    if (memoryHistory.length === 0) {
      // Public/embedded viewer → return to the previous page (e.g. the author page) via history
      if (!isAuthenticated && window.history.length > 1) {
        window.history.back();
        return;
      }
      navigate('/stories');
      return;
    }
    const prev = memoryHistory[memoryHistory.length - 1];
    setMemoryHistory(h => h.slice(0, -1));
    setMemoryData(prev);
    setCombinedPublishedTimeline(null);
    setActivePubLmId(null);
    setActiveMemoryIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [currentSubImageIndex, setCurrentSubImageIndex] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMobileShareMenu, setShowMobileShareMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showMobileComments, setShowMobileComments] = useState(false);
  const [mobileCarouselIndex, setMobileCarouselIndex] = useState(0);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showStickyMenu, setShowStickyMenu] = useState(false);
  const [showAuthorModal, setShowAuthorModal] = useState(false);
  const [showDesktopAuthorModal, setShowDesktopAuthorModal] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [activeMemoryIndex, setActiveMemoryIndex] = useState(0);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isHeaderImageScrolled, setIsHeaderImageScrolled] = useState(false);

  // ── "Request a Moment" contribution flow ──────────────────────────────────
  // Opened by a CTA widget the owner authored with mode 'request_moment', so any
  // visitor — signed in or not — can offer a photo + caption for review.
  const [showRequestMomentModal, setShowRequestMomentModal] = useState(false);
  // Which post the submission should land after; null = top of the timeline.
  const [requestMomentAfterPostId, setRequestMomentAfterPostId] = useState<string | null>(null);

  // Cars aren't real Memory records (see handleLinkedMemoryClick), so clicking one
  // opens a public, read-only, timeline-style view built entirely from the data on
  // the linked_memories entry — no extra fetch.
  // Step 2: the car whose timeline is open (null = not viewing a car).
  const [selectedCarDetail, setSelectedCarDetail] = useState<any | null>(null);
  // Step 3: index of the car photo open in the full-screen viewer; null = closed.
  const [carPhotoIndex, setCarPhotoIndex] = useState<number | null>(null);
  // Car photo viewer keyboard nav: Esc closes the viewer (back to the campaign),
  // ←/→ move between the car's photos.
  useEffect(() => {
    if (!selectedCarDetail) return;
    const imgs: string[] = (Array.isArray(selectedCarDetail.images) && selectedCarDetail.images.length)
      ? selectedCarDetail.images
      : (selectedCarDetail.cover_image ? [selectedCarDetail.cover_image] : []);
    const t = imgs.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedCarDetail(null);
      else if (t > 1 && e.key === 'ArrowLeft') setCarPhotoIndex((i) => (i === null ? 0 : (((i - 1) % t) + t) % t));
      else if (t > 1 && e.key === 'ArrowRight') setCarPhotoIndex((i) => (i === null ? 0 : (((i + 1) % t) + t) % t));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedCarDetail]);

  // Cover video state
  const [isCoverVideoPlaying, setIsCoverVideoPlaying] = useState(false);
  const [isCoverVideoHovered, setIsCoverVideoHovered] = useState(false);
  const [isCoverVideoEnded, setIsCoverVideoEnded] = useState(false);
  const coverVideoMobileRef = useRef<HTMLVideoElement>(null);
  const coverVideoDesktopRef = useRef<HTMLVideoElement>(null);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const ytPlayersRef = useRef<any[]>([]);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // React doesn't properly set the muted DOM property via JSX on <video>.
  // Set it directly after the video elements render so iOS Safari loads the content.
  useEffect(() => {
    const applyMuted = () => {
      if (coverVideoMobileRef.current) {
        coverVideoMobileRef.current.muted = true;
        coverVideoMobileRef.current.load();
      }
      if (coverVideoDesktopRef.current) {
        coverVideoDesktopRef.current.muted = true;
        coverVideoDesktopRef.current.load();
      }
    };
    applyMuted();
    // Also run after a short delay to catch conditional renders
    const t = setTimeout(applyMuted, 300);
    return () => clearTimeout(t);
  }, [memoryData?.last_update_img]);


  const handleToggleCoverVideo = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    const isDesktop = window.innerWidth >= 1024;
    const activeVideo = isDesktop ? coverVideoDesktopRef.current : coverVideoMobileRef.current;
    const inactiveVideo = isDesktop ? coverVideoMobileRef.current : coverVideoDesktopRef.current;
    // Always keep the hidden video paused and muted
    if (inactiveVideo) {
      inactiveVideo.pause();
      inactiveVideo.muted = true;
    }
    if (isCoverVideoPlaying) {
      activeVideo?.pause();
      setIsCoverVideoPlaying(false);
    } else {
      if (activeVideo) {
        if (isCoverVideoEnded) {
          activeVideo.currentTime = 0;
          setIsCoverVideoEnded(false);
        }
        activeVideo.muted = false;
        activeVideo.play().then(() => setIsCoverVideoPlaying(true)).catch(() => {});
      }
    }
  };

  const shareMenuRef = useRef<HTMLDivElement>(null);
  const mobileShareMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const stickyMenuRef = useRef<HTMLDivElement>(null);
  const memoryCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mobileMemoryCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Sentinel placed right before the first rendered content item (widget, post, or linked
  // memory) so "Continue" always lands on whatever is actually first on screen, regardless
  // of type — memoryCardRefs/mobileMemoryCardRefs only cover posts, and are keyed by each
  // post's position in `sortedPosts`, not by its position in the rendered timeline.
  const firstContentRef = useRef<HTMLDivElement>(null);
  const mobileFirstContentRef = useRef<HTMLDivElement>(null);
  const mobileScrollContainerRef = useRef<HTMLDivElement>(null);
  const continueJustTappedRef = useRef(false);
  const rightContentRef = useRef<HTMLDivElement>(null);
  const headerImageRef = useRef<HTMLDivElement>(null);
  const mobileHeaderImageRef = useRef<HTMLDivElement>(null);
  const timelineItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sidebarWidgetRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightScrollContainerRef = useRef<HTMLDivElement>(null);
  const [mobileActiveMemoryIndex, setMobileActiveMemoryIndex] = useState(0);

  // Storeel viewer beacon. Must be called unconditionally before the loading/
  // error early-returns below (rules of hooks), so it can't use the fully
  // sorted/filtered totalMomentsCount computed further down — this simpler
  // count is a close-enough proxy for milestone-percentage purposes.
  const storeelTotalMomentsEarly =
    (memoryData?.posts?.length || 0) + (memoryData?.linked_memories?.length || 0);
  const { trackCtaClick: trackStoreelCtaClick } = useStoreelTracking(
    storeelSendToken,
    Math.max(activeMemoryIndex, mobileActiveMemoryIndex),
    storeelTotalMomentsEarly
  );

  // Access token state for private memories
  const [requiresToken, setRequiresToken] = useState(false);
  const [enteredAccessToken, setEnteredAccessToken] = useState('');
  const [tokenError, setTokenError] = useState('');

  // Scroll-based header collapse (desktop - window scroll)
  useEffect(() => {
    const handleScroll = () => {
      setIsHeaderCollapsed(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  // IntersectionObserver for header image - detect when it scrolls out
  useEffect(() => {
    const headerObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Only show sticky bar when header has scrolled UP past the viewport (not on initial load)
          // Check if the top of the element is above the viewport (negative boundingClientRect.top)
          const hasScrolledPastTop = entry.boundingClientRect.top < 0;
          setIsHeaderImageScrolled(!entry.isIntersecting && hasScrolledPastTop);
        });
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0
      }
    );

    if (headerImageRef.current) {
      headerObserver.observe(headerImageRef.current);
    }

    return () => {
      headerObserver.disconnect();
    };
  }, [memoryData]);

  // IntersectionObserver for scroll sync - track which memory card is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const widgetId = entry.target.getAttribute('data-pub-widget-id');
            const lmId = entry.target.getAttribute('data-pub-lm-id');
            const index = Number(entry.target.getAttribute('data-index'));
            if (widgetId) {
              setActiveWidgetId(widgetId);
              setActiveMemoryIndex(-1);
              setActivePubLmId(null);
            } else if (lmId) {
              setActivePubLmId(lmId);
              setActiveMemoryIndex(-1);
              setActiveWidgetId(null);
            } else if (!isNaN(index)) {
              setActiveMemoryIndex(index);
              setActivePubLmId(null);
              setActiveWidgetId(null);
            }
          }
        });
      },
      {
        root: rightScrollContainerRef.current || null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0
      }
    );

    memoryCardRefs.current.forEach((ref) => { if (ref) observer.observe(ref); });

    // Also observe linked memory cards and content widgets
    document.querySelectorAll('[data-pub-lm-id]').forEach((el) => observer.observe(el));
    document.querySelectorAll('[data-pub-widget-id]').forEach((el) => observer.observe(el));

    return () => { observer.disconnect(); };
  }, [memoryData, combinedPublishedTimeline]);

  // Auto-scroll timeline item into view when activeMemoryIndex changes
  useEffect(() => {
    const el = timelineItemRefs.current[activeMemoryIndex];
    if (el && isHeaderImageScrolled) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeMemoryIndex, isHeaderImageScrolled]);

  // Auto-scroll the sidebar to the active widget entry when it changes
  useEffect(() => {
    if (!activeWidgetId) return;
    const el = sidebarWidgetRefs.current[activeWidgetId];
    if (el && isHeaderImageScrolled) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeWidgetId, isHeaderImageScrolled]);

  // IntersectionObserver for mobile scroll sync - track which memory card is visible
  useEffect(() => {
    const mobileObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-mobile-index'));
            if (!isNaN(index)) {
              setMobileActiveMemoryIndex(index);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '-30% 0px -50% 0px',
        threshold: 0
      }
    );

    mobileMemoryCardRefs.current.forEach((ref) => {
      if (ref) {
        mobileObserver.observe(ref);
      }
    });

    return () => {
      mobileObserver.disconnect();
    };
  }, [memoryData]);

  // Generate consistent color for user avatar based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-600',
      'bg-purple-600',
      'bg-pink-600',
      'bg-red-600',
      'bg-orange-600',
      'bg-yellow-600',
      'bg-green-600',
      'bg-teal-600',
      'bg-cyan-600',
      'bg-indigo-600'
    ];

    // Generate a hash from the name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Use the hash to pick a color consistently
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
      if (mobileShareMenuRef.current && !mobileShareMenuRef.current.contains(event.target as Node)) {
        setShowMobileShareMenu(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
      if (stickyMenuRef.current && !stickyMenuRef.current.contains(event.target as Node)) {
        setShowStickyMenu(false);
      }
    };

    if (showShareMenu || showMobileShareMenu || showSortMenu || showStickyMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showShareMenu, showMobileShareMenu, showSortMenu]);

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Check for access_token and redirect to login if not authenticated
  useEffect(() => {
    if (accessToken && !isAuthenticated && !loading) {
      // Store the current URL to redirect back after login
      const fullUrl = window.location.pathname + window.location.search;
      sessionStorage.setItem('redirectAfterLogin', JSON.stringify({
        url: fullUrl,
        slug: slug,
        timestamp: Date.now()
      }));
      localStorage.setItem('pendingRedirectAfterLogin', JSON.stringify({
        url: fullUrl,
        slug: slug,
        timestamp: Date.now()
      }));

      console.log('🔐 Access token detected but not authenticated. Redirecting to login...');
      toast.info("Please login to access this private campaign");
      navigate(`/login?redirect=${encodeURIComponent(fullUrl)}`);
    }
  }, [accessToken, isAuthenticated, navigate, loading, slug]);

  useEffect(() => {
    const fetchPublishedMemory = async () => {
      if (!slug) {
        setError("Campaign not found");
        setLoading(false);
        return;
      }

      // If access_token is present but user is not authenticated, don't fetch yet
      if (accessToken && !isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('Fetching published memory with slug:', slug);

        // Use access token from URL or manually entered token
        const tokenToUse = accessToken || enteredAccessToken || undefined;

        const response = await dashboardAPI.getPublishedMemory(slug, tokenToUse);
        console.log('📥 Published Memory Response:', response);
        console.log('📥 Response.data:', response?.data);
        console.log('📥 Response.data.requires_token?', response?.data?.requires_token);
        console.log('📥 Response.data.status:', response?.data?.status);

        // FIRST: Check if memory requires private access token
        // The API returns: {success: true, data: {status: 0, requires_token: true, ...}}
        if (response && response.data && response.data.requires_token === true) {
          console.log('🔒 Memory requires private access token');
          setRequiresToken(true);
          setError(null);
          setMemoryData(null);

          // If user already entered a token and it's still asking, the token is invalid
          if (enteredAccessToken) {
            console.log('❌ Invalid access token entered');
            setTokenError('Invalid access token. Please check and try again.');
            setEnteredAccessToken(''); // Clear the invalid token
          }

          setLoading(false);
          return;
        }

        // Check for different response structures (successful response with memory data)
        if (response && (response.success || response.status === 1) && response.data) {
          // The actual data is nested in response.data.data
          const actualData = response.data.data || response.data;
          const memory = actualData.memory;
          console.log('Memory data found:', memory);

          if (memory) {
            setMemoryData({
              ...memory,
              docusign_documents: memory?.docusign_documents ?? actualData?.docusign_documents,
              linked_memories: memory?.linked_memories ?? actualData?.linked_memories ?? [],
              unified_order: memory?.unified_order ?? actualData?.unified_order ?? null,
              widgets: memory?.widgets ?? actualData?.widgets ?? [],
            });
            setSortOrder(actualData.order_by || 'asc');
            setRequiresToken(false);
            setTokenError('');
            // Track view count — fire and forget, don't block rendering
            if (memory.id) {
              dashboardAPI.trackMemoryView(memory.id).catch(() => {});
            }
          } else {
            console.error('Memory not found in response');
            setError('Failed to load published campaign');
            toast.error("Failed to load campaign");
          }
        } else {
          console.error('Invalid response structure:', response);
          setError('Failed to load published campaign');
          toast.error("Failed to load campaign");
        }
      } catch (err: any) {
        console.error('Error fetching published memory:', err);
        setError(err.message || 'An error occurred while loading the campaign');
        toast.error("Failed to load campaign");
      } finally {
        setLoading(false);
      }
    };

    fetchPublishedMemory();
  }, [slug, accessToken, isAuthenticated, enteredAccessToken]);

  // Restore image modal state after login/signup redirect
  useEffect(() => {
    if (!loading && memoryData) {
      // First check for post_id in URL parameter (from social media share links)
      if (postIdParam) {
        console.log('🔍 Post ID in URL parameter:', postIdParam);

        const posts = (memoryData.posts || []).filter((p: any) => p.admin_approval !== 0);
        const postIndex = posts.findIndex((p: any) => String(p.id) === String(postIdParam));

        if (postIndex !== -1) {
          const post = posts[postIndex];
          console.log('✅ Found post at index:', postIndex, 'Opening modal...');

          setTimeout(() => {
            handleImageClick(post, postIndex);
            console.log('✅ Post modal opened from URL parameter');
          }, 500);
        } else {
          console.log('❌ Post not found with id:', postIdParam);
        }

        return; // Exit early after handling post_id parameter
      }

      // Then check for autoOpenPostModal (from redirects after auth)
      const autoOpenPostId = sessionStorage.getItem('autoOpenPostModal');
      if (autoOpenPostId) {
        console.log('🔍 Auto-opening post modal for post_id:', autoOpenPostId);

        const posts = (memoryData.posts || []).filter((p: any) => p.admin_approval !== 0);
        const postIndex = posts.findIndex((p: any) => String(p.id) === String(autoOpenPostId));

        if (postIndex !== -1) {
          const post = posts[postIndex];
          console.log('✅ Found post at index:', postIndex, 'Opening modal...');

          setTimeout(() => {
            handleImageClick(post, postIndex);
            sessionStorage.removeItem('autoOpenPostModal');
            console.log('✅ Post modal opened and autoOpenPostModal cleared');
          }, 500);
        } else {
          console.log('❌ Post not found with id:', autoOpenPostId);
          sessionStorage.removeItem('autoOpenPostModal');
        }

        return; // Exit early, don't check redirectAfterLogin
      }

      // Check both sessionStorage and localStorage for redirect data
      let redirectData = sessionStorage.getItem('redirectAfterLogin') ||
                         localStorage.getItem('pendingRedirectAfterLogin');

      console.log('🔍 Checking for redirect data, isAuthenticated:', isAuthenticated, 'redirectData:', !!redirectData);

      if (redirectData) {
        try {
          const { url, imageIndex, openComments, slug: storedSlug, timestamp } = JSON.parse(redirectData);

          console.log('🔍 Redirect data found:', { url, imageIndex, openComments, slug: storedSlug, currentSlug: slug, isAuthenticated });

          // Check if redirect is recent (within last 5 minutes) and for this page
          const isRecent = timestamp && (Date.now() - timestamp < 5 * 60 * 1000);

          // Only open modal if user is now authenticated (after login/signup)
          if (isRecent && storedSlug === slug && imageIndex !== undefined && isAuthenticated) {
            const posts = (memoryData.posts || []).filter((p: any) => p.admin_approval !== 0);
            const sortedPosts = sortOrder === 'desc' ? [...posts].reverse() : posts;
            const post = sortedPosts[imageIndex];

            console.log('✅ Opening image modal at index:', imageIndex, 'post:', post);

            if (post) {
              // Open the image modal with the stored index
              setTimeout(() => {
                handleImageClick(post, imageIndex);
                if (openComments) {
                  setShowMobileComments(true);
                }
                // Clear the redirect data after successful restoration
                sessionStorage.removeItem('redirectAfterLogin');
                localStorage.removeItem('pendingRedirectAfterLogin');
                console.log('✅ Image modal opened and redirect data cleared');
              }, 500);
            } else {
              console.log('❌ Post not found at index:', imageIndex);
              // Clear if post not found
              sessionStorage.removeItem('redirectAfterLogin');
              localStorage.removeItem('pendingRedirectAfterLogin');
            }
          } else if (!isAuthenticated) {
            console.log('⏳ Waiting for authentication before opening modal...');
            // Don't clear the data yet - wait for authentication
          } else {
            console.log('⚠️ Redirect data is stale or not for this page');
            // Clear stale data
            sessionStorage.removeItem('redirectAfterLogin');
            localStorage.removeItem('pendingRedirectAfterLogin');
          }
        } catch (error) {
          console.error('❌ Error restoring image modal:', error);
          sessionStorage.removeItem('redirectAfterLogin');
          localStorage.removeItem('pendingRedirectAfterLogin');
        }
      }
    }
  }, [loading, memoryData, isAuthenticated, slug, sortOrder, postIdParam]);

  // Handle keyboard shortcuts for image viewer - MUST be before early returns
  useEffect(() => {
    if (!imageViewer.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const posts = (memoryData?.posts || []).filter((p: any) => p.admin_approval !== 0);
      const sortedPosts = sortOrder === 'desc' ? [...posts].reverse() : posts;

      switch (e.key) {
        case 'Escape':
          handleCloseImageViewer();
          break;
        case 'ArrowLeft':
          if (imageViewer.currentIndex > 0) {
            const prevIndex = imageViewer.currentIndex - 1;
            const prevPost = sortedPosts[prevIndex];
            if (prevPost) {
              setImageViewer({
                isOpen: true,
                imageId: prevPost.id,
                imageSrc: prevPost.image_link || prevPost.master_image_link,
                imageAlt: prevPost.name || 'Moment',
                currentIndex: prevIndex,
                user_name: prevPost.user?.name || memoryData?.user?.name,
                user_profile: prevPost.user?.profile_image || memoryData?.user?.profile_image,
                location: prevPost.location,
                uploaded_at: prevPost.uploaded_at,
                capture_date: prevPost.capture_date,
                description: prevPost.description,
                comments_count: prevPost.comments_count,
                comments: prevPost.comments || []
              });
            }
          }
          break;
        case 'ArrowRight':
          if (imageViewer.currentIndex < sortedPosts.length - 1) {
            const nextIndex = imageViewer.currentIndex + 1;
            const nextPost = sortedPosts[nextIndex];
            if (nextPost) {
              setImageViewer({
                isOpen: true,
                imageId: nextPost.id,
                imageSrc: nextPost.image_link || nextPost.master_image_link,
                imageAlt: nextPost.name || 'Moment',
                currentIndex: nextIndex,
                user_name: nextPost.user?.name || memoryData?.user?.name,
                user_profile: nextPost.user?.profile_image || memoryData?.user?.profile_image,
                location: nextPost.location,
                uploaded_at: nextPost.uploaded_at,
                capture_date: nextPost.capture_date,
                description: nextPost.description,
                comments_count: nextPost.comments_count,
                comments: nextPost.comments || []
              });
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [imageViewer.isOpen, imageViewer.currentIndex, memoryData, sortOrder]);

  // YouTube IFrame API — autoplay with sound (must be before any early returns)
  useEffect(() => {
    const coverSrc = memoryData?.last_update_img || memoryData?.posts?.[0]?.master_image_link || memoryData?.linked_memories?.[0]?.cover_image;
    if (!coverSrc || !isYoutubeUrl(coverSrc)) return;
    const videoId = getYoutubeVideoId(coverSrc);
    if (!videoId) return;

    const playerVars = { autoplay: 1, mute: 1, loop: 1, playlist: videoId, rel: 0, playsinline: 1 };

    const onReady = (e: any) => {
      e.target.playVideo();
      e.target.unMute();
      e.target.setVolume(100);
    };

    const createPlayers = () => {
      ytPlayersRef.current.forEach(p => { try { p.destroy(); } catch {} });
      ytPlayersRef.current = [];
      ['yt-cover-mobile', 'yt-cover-desktop'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          const p = new (window as any).YT.Player(id, { videoId, playerVars, events: { onReady } });
          ytPlayersRef.current.push(p);
        }
      });
    };

    if ((window as any).YT?.Player) {
      createPlayers();
    } else {
      if (!document.getElementById('yt-api-script')) {
        const s = document.createElement('script');
        s.id = 'yt-api-script';
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
      }
      (window as any).onYouTubeIframeAPIReady = createPlayers;
    }

    return () => {
      ytPlayersRef.current.forEach(p => { try { p.destroy(); } catch {} });
      ytPlayersRef.current = [];
    };
  }, [memoryData?.last_update_img, memoryData?.posts?.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-[#6C60FF] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">{accessToken ? 'Verifying access...' : 'Loading campaign...'}</p>
        </div>
      </div>
    );
  }

  if (isLoadingSubMemory) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-[#6C60FF] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading campaign...</p>
        </div>
      </div>
    );
  }

  // If access_token is present but user is not authenticated, show nothing (will redirect)
  if (accessToken && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-[#6C60FF] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Show access token input if private memory requires token
  if (requiresToken && !memoryData) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-md p-8">
            {/* Lock Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-[#6C60FF]" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Private Campaign
            </h2>

            {/* Description */}
            <p className="text-gray-600 text-center mb-6">
              This campaign requires an access token to view. Please enter the access token provided by the publisher.
            </p>

            {/* Access Token Input */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Access Token
                </label>
                <input
                  type="text"
                  value={enteredAccessToken}
                  onChange={(e) => {
                    setEnteredAccessToken(e.target.value);
                    setTokenError('');
                  }}
                  placeholder="Enter your access token..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-transparent"
                  autoFocus
                />
              </div>

              {/* Error Message */}
              {tokenError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{tokenError}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={() => {
                  if (!enteredAccessToken.trim()) {
                    setTokenError('Please enter an access token');
                    return;
                  }
                  setLoading(true);
                }}
                disabled={loading || !enteredAccessToken.trim()}
                className="w-full bg-[#6C60FF] hover:bg-[#5B52FF] text-white py-3 text-base font-medium"
              >
                {loading ? 'Verifying...' : 'Submit Access Token'}
              </Button>
            </div>

            {/* Back Button */}
            <button
              onClick={() => window.location.href = 'https://studio.stasht.com'}
              className="w-full mt-4 text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              ← Go Back
            </button>
          </div>
        </div>
      </>
    );
  }

  // Don't show error if we're showing the access token input
  if ((error || !memoryData) && !requiresToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Campaign Not Found</h2>
          <p className="text-gray-600 mb-6">{error || "This campaign doesn't exist or is no longer available."}</p>
        </div>
      </div>
    );
  }

  const allPosts = (memoryData.posts || []).filter((post: any) => post.admin_approval !== 0);

  // Filter out sub-images (posts with parent_id) and group them with their parent
  const isSubImage = (post: any) => {
    const parentId = post.parent_id;
    return parentId !== null && parentId !== undefined && parentId !== '' && parentId !== 0 && parentId !== '0';
  };

  // Get only parent posts (not sub-images)
  const parentPosts = allPosts.filter((post: any) => !isSubImage(post));

  // Create a map of parent_id -> sub_images array
  const subImagesMap: Record<string, any[]> = {};
  allPosts.forEach((post: any) => {
    if (isSubImage(post)) {
      const parentId = post.parent_id?.toString();
      if (parentId) {
        if (!subImagesMap[parentId]) {
          subImagesMap[parentId] = [];
        }
        subImagesMap[parentId].push(post);
      }
    }
  });

  // Attach sub_images to each parent post
  const postsWithSubImages = parentPosts.map((post: any) => ({
    ...post,
    sub_images: subImagesMap[post.id?.toString()] || []
  }));

  const sortedPosts = (() => {
    const hasAfterPostId = postsWithSubImages.some((p: any) =>
      p.after_post_id != null && p.after_post_id !== 0 && p.after_post_id !== '0' && p.after_post_id !== ''
    );

    if (hasAfterPostId) {
      // Build a next-map: after_post_id -> the post that follows it
      const nextMap = new Map<string, any>();
      postsWithSubImages.forEach((p: any) => {
        if (p.after_post_id != null && p.after_post_id !== 0 && p.after_post_id !== '0' && p.after_post_id !== '') {
          nextMap.set(String(p.after_post_id), p);
        }
      });

      // First post is the one with no after_post_id
      const first = postsWithSubImages.find((p: any) =>
        !p.after_post_id || p.after_post_id === 0 || p.after_post_id === '0' || p.after_post_id === ''
      );
      if (!first) return postsWithSubImages;

      const ordered: any[] = [];
      const visited = new Set<string>();
      let current = first;
      while (current && !visited.has(String(current.id))) {
        ordered.push(current);
        visited.add(String(current.id));
        current = nextMap.get(String(current.id));
      }

      // Append any posts not reached by the chain
      postsWithSubImages.forEach((p: any) => {
        if (!visited.has(String(p.id))) ordered.push(p);
      });

      return ordered;
    }

    // Fallback: sort by capture_date descending
    return [...postsWithSubImages].sort((a: any, b: any) => {
      const dateA = a.capture_date || a.uploaded_at || '';
      const dateB = b.capture_date || b.uploaded_at || '';
      return dateB.localeCompare(dateA);
    });
  })();
  sortedPostsRef.current = sortedPosts;

  // ── Widgets (html / youtube / quote / cta) from the API response ──
  // Group visible/approved widgets by after_post_id so each renders after its post,
  // in widget_order. Widgets with a null/empty after_post_id render at the top.
  const publishedWidgets = (memoryData?.widgets || [])
    .filter((w: any) => w && w.is_visible !== false && w.admin_approval !== 0)
    .slice()
    .sort((a: any, b: any) => (a.widget_order ?? 0) - (b.widget_order ?? 0));
  // Widgets pinned to bottom render at the very end of the timeline regardless of their
  // after_post_id — matching the owner/editor view. Keep them out of the per-post grouping.
  const bottomWidgetList: any[] = publishedWidgets.filter((w: any) => w.widget_data?.pinToBottom);
  const widgetsByAfterPostId = (() => {
    const map = new Map<string, any[]>();
    publishedWidgets.forEach((w: any) => {
      if (w.widget_data?.pinToBottom) return; // rendered at the end via bottomWidgetList
      const key = (w.after_post_id === null || w.after_post_id === undefined || w.after_post_id === '' || w.after_post_id === 0 || w.after_post_id === '0')
        ? 'top'
        : String(w.after_post_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    });
    return map;
  })();
  const widgetsAfter = (postId: any): any[] => widgetsByAfterPostId.get(String(postId)) || [];
  const topWidgetList: any[] = widgetsByAfterPostId.get('top') || [];
  // Render the widget cards for the content column. On desktop we tag each with
  // data-pub-widget-id so the left timeline nav can scroll to it (matching how
  // linked memories use data-pub-lm-id — desktop only, to avoid duplicate anchors).
  const renderWidgets = (list: any[], withAnchor: boolean) =>
    list.map((w: any) => (
      withAnchor
        ? <div key={`widget-${w.id}`} data-pub-widget-id={w.id}><PublishedWidget widget={w} memoryId={memoryData?.id} onRequestMoment={openRequestMoment} onCtaClick={trackStoreelCtaClick} /></div>
        : <PublishedWidget key={`widget-${w.id}`} widget={w} memoryId={memoryData?.id} onRequestMoment={openRequestMoment} onCtaClick={trackStoreelCtaClick} />
    ));
  // The combined timeline actually rendered by both feeds. Falls back to a
  // post-only list before the API's unified_order has been merged in.
  const publishedTimelineItems: Array<{ type: 'post' | 'linked'; id: string }> =
    combinedPublishedTimeline || sortedPosts.map((p: any) => ({ type: 'post' as const, id: String(p.id) }));

  // "N moments" in the Timeline header should count linked memories (incl. car listings) too,
  // not just this memory's own posts — otherwise a memory made entirely of linked items shows 0.
  const totalMomentsCount = sortedPosts.length + (memoryData?.linked_memories?.length || 0);

  const openRequestMoment = (afterPostId?: string | null) => {
    setRequestMomentAfterPostId(afterPostId || null);
    setShowRequestMomentModal(true);
  };

  // Title + subtitle + type icon for a widget's entry in the left timeline nav.
  // Mirrors the Studio (MemoryDetailsPage) sidebar widget entries.
  const widgetNodeMeta = (w: any): { title: string; subtitle: string; Icon: React.ComponentType<{ className?: string }> } => {
    const d = w?.widget_data || {};
    switch (w?.widget_type) {
      case 'cta': return { title: d.title || 'Call to Action', subtitle: d.buttonText || 'Button', Icon: Pointer };
      case 'quote': return { title: d.text || 'Quote', subtitle: d.author ? `— ${d.author}` : '', Icon: Quote };
      case 'html': return { title: d.title || 'Note', subtitle: '', Icon: FileText };
      case 'youtube': return { title: d.title || 'Video', subtitle: '', Icon: Play };
      case 'product': return { title: d.title || 'Product', subtitle: d.price ? (d.currency ? `${d.currency} ${d.price}` : String(d.price)) : '', Icon: ShoppingCart };
      default: return { title: 'Widget', subtitle: '', Icon: Circle };
    }
  };
  // A left-timeline entry for a widget, styled to match the Studio's widget entries
  // (purple round type-icon node + title + subtitle). Clicking it scrolls the matching
  // content widget into view. showBorder draws the connecting rail (kept consistent with
  // the post nodes above/below so the timeline line aligns).
  const renderSidebarWidgetNode = (w: any, showBorder: boolean) => {
    const { title, subtitle, Icon } = widgetNodeMeta(w);
    const isActive = activeWidgetId === String(w.id) && isHeaderImageScrolled;
    return (
      <div
        key={`sidebar-widget-${w.id}`}
        ref={(el) => { sidebarWidgetRefs.current[String(w.id)] = el; }}
        className={`relative pl-8 pb-4 cursor-pointer transition-all duration-200 ml-3 ${showBorder ? 'border-l-2 border-gray-200' : ''}`}
        onClick={() => {
          const el = document.querySelector(`[data-pub-widget-id="${w.id}"]`) as HTMLElement | null;
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      >
        <div className={`absolute -left-3.5 top-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-[#6C60FF] text-white shadow-md' : 'bg-[#6C60FF]/10 text-[#6C60FF]'}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="transition-all duration-200 opacity-100">
          <p className={`leading-snug hover:text-[#6C60FF] cursor-pointer line-clamp-2 ${isActive ? 'text-xl font-medium text-gray-900' : 'text-[#101828] text-lg'}`}>{title}</p>
          {subtitle && (
            <div className="flex items-center gap-1.5 mt-1 text-gray-400 text-sm">
              <Icon className="w-4 h-4" /><span className="line-clamp-1">{subtitle}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Get the memory image for Open Graph tags (ensure it's an absolute URL)
  const getAbsoluteImageUrl = (imageUrl: string | undefined) => {
    // If no image URL provided, return a fallback default image
    if (!imageUrl) {
      // Use a default Stasht logo or placeholder image (replace with your actual default image URL)
      return `${window.location.origin}/default-memory-image.jpg`;
    }

    // If the URL is already absolute, return it
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    // If it's a relative URL, make it absolute
    if (imageUrl.startsWith('/')) {
      return `${window.location.origin}${imageUrl}`;
    }
    // Otherwise, prepend the origin
    return `${window.location.origin}/${imageUrl}`;
  };

  // Get the best available image for Open Graph tags
  const memoryImage = memoryData.last_update_img ||
                     allPosts[0]?.master_image_link ||
                     allPosts[0]?.image_link ||
                     memoryData?.linked_memories?.[0]?.cover_image;

  const ogImageUrl = getAbsoluteImageUrl(memoryImage);

  // Get post-specific data for Open Graph tags if post_id is in URL
  const specificPost = postIdParam ? allPosts.find((p: any) => p.id?.toString() === postIdParam) : null;

  // Read og_title and og_image from URL query params (appended by backend when generating share link)
  const urlSearchParams = new URLSearchParams(window.location.search);
  const urlOgTitle = urlSearchParams.get('og_title');
  const urlOgImage = urlSearchParams.get('og_image');

  // Use post-specific data if available, then URL params, otherwise use memory data
  const ogTitle = specificPost?.title || specificPost?.name || urlOgTitle || memoryData.title;
  const ogDescription = specificPost?.content || specificPost?.description || memoryData.description || `View this memory: ${memoryData.title}`;
  const ogImage = specificPost
    ? getAbsoluteImageUrl(specificPost.master_image_link || specificPost.image_link || specificPost.image)
    : (urlOgImage || ogImageUrl);

  // Debug logging to help troubleshoot
  console.log('🖼️ Open Graph Data:', {
    postIdParam,
    specificPost: specificPost ? { id: specificPost.id, title: specificPost.title || specificPost.name } : null,
    ogTitle,
    ogDescription: ogDescription?.substring(0, 100),
    ogImage,
    memoryImage,
    finalOgImageUrl: ogImageUrl
  });

  // Get dates from memoryData (use min_uploaded_img_date and max_uploaded_img_date)
  const minDate = memoryData.min_uploaded_img_date ? new Date(memoryData.min_uploaded_img_date) : null;
  const maxDate = memoryData.max_uploaded_img_date ? new Date(memoryData.max_uploaded_img_date) : null;

  const formatDateRange = () => {
    if (isCarCampaign(memoryData)) return ''; // dates are meaningless for car campaigns
    if (!minDate || !maxDate) return '';

    // Format like "Oct 19 - Oct 30, 2025"
    if (minDate.getTime() === maxDate.getTime()) {
      // Same date: "Oct 19, 2025"
      return minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // Different dates in same month and year: "Oct 19 - 30, 2025"
    if (minDate.getMonth() === maxDate.getMonth() && minDate.getFullYear() === maxDate.getFullYear()) {
      const minDay = minDate.getDate();
      const maxFormatted = maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${minDate.toLocaleDateString('en-US', { month: 'short' })} ${minDay} - ${maxFormatted}`;
    }

    // Different months: "Oct 19 - Nov 30, 2025"
    return `${minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const formatCompactDate = (date: Date) =>
    `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}/${String(date.getFullYear()).slice(-2)}`;

  const formatStickyDateRange = () => {
    if (!minDate) return '';
    if (!maxDate || minDate.getTime() === maxDate.getTime()) return formatCompactDate(minDate);
    return `${formatCompactDate(minDate)} - ${formatCompactDate(maxDate)}`;
  };

  // Handle opening image viewer
  const handleImageClick = (post: any, index: number) => {
    console.log('Opening image viewer with post:', post);
    console.log('Post comments:', post.comments);
    console.log('Post sub_images:', post.sub_images);

    setCurrentSubImageIndex(0); // Reset sub-image index
    setImageViewer({
      isOpen: true,
      imageId: post.id,
      imageSrc: post.image_link || post.master_image_link,
      imageAlt: post.name || 'Moment',
      currentIndex: index,
      user_name: post.user?.name || memoryData.user?.name,
      user_profile: post.user?.profile_image || memoryData.user?.profile_image,
      location: post.location,
      uploaded_at: post.uploaded_at,
      capture_date: post.capture_date,
      description: post.description,
      comments_count: post.comments_count,
      comments: post.comments || [],
      sub_images: post.sub_images || [],
      title: post.title || post.name || ''
    });
  };

  // Handle comment click - open image viewer and show comments
  const handleCommentClick = (post: any, index: number) => {
    handleImageClick(post, index);
    setShowMobileComments(true);
  };

  // Handle closing image viewer
  const handleCloseImageViewer = () => {
    setImageViewer({
      isOpen: false,
      imageSrc: '',
      imageAlt: '',
      currentIndex: 0
    });

    // If modal was opened from a post_id URL parameter, remove it from URL
    if (postIdParam) {
      console.log('🔗 Removing post_id parameter from URL');
      // Create new URL without post_id parameter
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('post_id');

      // Update URL without reloading the page
      const newUrl = newSearchParams.toString()
        ? `${window.location.pathname}?${newSearchParams.toString()}`
        : window.location.pathname;

      window.history.replaceState({}, '', newUrl);
    }
  };

  // Handle next image in viewer
  const handleNextImage = () => {
    const nextIndex = imageViewer.currentIndex + 1;
    if (nextIndex < sortedPosts.length) {
      const nextPost = sortedPosts[nextIndex];
      handleImageClick(nextPost, nextIndex);
    }
  };

  // Handle previous image in viewer
  const handlePrevImage = () => {
    const prevIndex = imageViewer.currentIndex - 1;
    if (prevIndex >= 0) {
      const prevPost = sortedPosts[prevIndex];
      handleImageClick(prevPost, prevIndex);
    }
  };

  // Sub-images helper variables
  const viewerSubImages = imageViewer.sub_images || [];
  const totalSubImages = viewerSubImages.length;
  const hasSubImages = totalSubImages > 0;

  // Get current display image (main or sub-image)
  const getCurrentDisplayImage = () => {
    if (currentSubImageIndex === 0) {
      return {
        src: imageViewer.imageSrc,
        alt: imageViewer.imageAlt,
        id: imageViewer.imageId
      };
    } else {
      const subImage = viewerSubImages[currentSubImageIndex - 1];
      return {
        src: subImage?.image_link || subImage?.master_image_link || '',
        alt: subImage?.name || `Sub-image ${currentSubImageIndex}`,
        id: subImage?.id
      };
    }
  };

  const currentDisplayImage = getCurrentDisplayImage();

  // Handle submitting a comment
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !imageViewer.imageId) return;

    try {
      console.log('Submitting comment for post:', imageViewer.imageId);
      const response = await dashboardAPI.addPostComment(imageViewer.imageId, newComment.trim());

      if (response.success) {
        toast.success("Comment added successfully!");

        // Create the new comment object to add to local state
        const newCommentObj = {
          id: response.data?.comment?.id || Date.now().toString(),
          description: newComment.trim(),
          user: {
            name: user?.name || 'You',
            profile_image: user?.avatar || null
          },
          created_at: new Date().toISOString(),
          replies: []
        };

        // Update imageViewer with new comment
        setImageViewer(prev => ({
          ...prev,
          comments: [...(prev.comments || []), newCommentObj],
          comments_count: (prev.comments_count || 0) + 1
        }));

        // Update the post in memoryData
        setMemoryData((prevData: any) => {
          if (!prevData || !prevData.posts) return prevData;

          const updatedPosts = prevData.posts.map((post: any) => {
            if (post.id === imageViewer.imageId) {
              return {
                ...post,
                comments: [...(post.comments || []), newCommentObj],
                comments_count: (post.comments_count || 0) + 1
              };
            }
            return post;
          });

          return {
            ...prevData,
            posts: updatedPosts
          };
        });

        // Clear comment input
        setNewComment("");
      } else {
        toast.error(response.error || "Failed to add comment");
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error("Failed to add comment");
    }
  };

  // Share handlers
  const getPublishedUrl = () => memoryData?.published_url || `${window.location.origin}/published-memory/${slug}`;

  const handleCopyLink = () => {
    const url = getPublishedUrl();
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard!");
      setShowShareMenu(false);
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  const handleShareFacebook = () => {
    const url = getPublishedUrl();
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    setShowShareMenu(false);
  };

  const handleShareX = () => {
    const url = getPublishedUrl();
    const authorName = memoryData?.user?.name || 'Unknown';
    const postText = `${memoryData?.title || 'Check out this campaign'} — Shared by ${authorName}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(postText)}&url=${encodeURIComponent(url)}`, '_blank');
    setShowShareMenu(false);
  };

  const handleShareLinkedIn = () => {
    const url = getPublishedUrl();
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
    setShowShareMenu(false);
  };

  const handleEmbedCode = () => {
    const embedCode = `<iframe src="${getPublishedUrl()}" width="600" height="800" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(embedCode).then(() => {
      toast.success("Embed code copied to clipboard!");
      setShowShareMenu(false);
    }).catch(() => {
      toast.error("Failed to copy embed code");
    });
  };

  return (
    <>
      {/* Toast notifications */}
      <Toaster position="top-right" richColors />

      {/* SEO and Social Media Meta Tags */}
      <Helmet>
        <title>{ogTitle} - Stasht</title>
        <meta name="description" content={ogDescription} />

        {/* Open Graph / Facebook */}
        <meta property="og:site_name" content="Stasht" />
        <meta property="og:type" content={specificPost ? "article" : "website"} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />

        {/* Only add image meta tags if we have a real image (not the fallback) */}
        {ogImage && !ogImage.includes('default-memory-image') && (
          <>
            <meta property="og:image" content={ogImage} />
            <meta property="og:image:secure_url" content={ogImage} />
            <meta property="og:image:type" content="image/jpeg" />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={ogTitle} />
          </>
        )}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@stasht" />
        <meta name="twitter:url" content={window.location.href} />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />

        {/* Only add Twitter image if we have a real image */}
        {ogImage && !ogImage.includes('default-memory-image') && (
          <>
            <meta name="twitter:image" content={ogImage} />
            <meta name="twitter:image:alt" content={ogTitle} />
          </>
        )}
      </Helmet>

      {/* MOBILE LAYOUT */}
      <div className="lg:hidden min-h-screen bg-[#F8F8FA]">
        {/* Header Image with Overlay - shorter height to allow cards to overlap */}
        <div ref={mobileHeaderImageRef} className="relative" style={{ height: '78vh' }}>
          {(() => {
            const coverSrc = memoryData.last_update_img || allPosts[0]?.master_image_link || memoryData?.linked_memories?.[0]?.cover_image;
            return isYoutubeUrl(coverSrc) ? (
              <div id="yt-cover-mobile" className="w-full h-full absolute inset-0 rounded-b-3xl overflow-hidden" />
            ) : isVideoUrl(coverSrc) ? (
              <div className="absolute inset-0 rounded-b-3xl overflow-hidden">
                <video
                  ref={coverVideoMobileRef}
                  src={coverSrc}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  preload="metadata"
                  onEnded={() => { setIsCoverVideoPlaying(false); setIsCoverVideoEnded(true); }}
                />
              </div>
            ) : (
              <ImageWithFallback
                src={coverSrc}
                alt={memoryData.title}
                className="w-full h-full object-cover absolute inset-0 rounded-b-3xl"
                fallback={
                  <div className="absolute inset-0 rounded-b-3xl bg-gray-100 flex items-center justify-center">
                    {memoryData.user?.profile_image ? (
                      <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/60">
                        <img
                          src={memoryData.user.profile_image}
                          className="w-full h-full object-cover"
                          alt={memoryData.user?.name || 'User'}
                        />
                      </div>
                    ) : (
                      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#6C60FF] to-purple-600 flex items-center justify-center text-white text-4xl font-semibold border-4 border-white/60">
                        {memoryData.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                }
              />
            );
          })()}

          {/* Black Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent rounded-b-3xl pointer-events-none" />

          {/* Cover Video Play/Pause */}
          {isVideoUrl(memoryData.last_update_img || allPosts[0]?.master_image_link || memoryData?.linked_memories?.[0]?.cover_image) && (
            <button
              type="button"
              className="absolute inset-0 w-full h-full flex items-center justify-center bg-transparent border-0 p-0 z-20"
              onClick={handleToggleCoverVideo}
            >
              <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                {isCoverVideoPlaying
                  ? <Pause className="w-6 h-6 text-white" />
                  : <Play className="w-6 h-6 text-white ml-0.5" />
                }
              </div>
            </button>
          )}

          {/* Logo - Top Right */}
          <div className="fixed top-4 right-4 opacity-45 z-[5]">
            <svg width="91" height="23" viewBox="0 0 91 23" fill="none" xmlns="http://www.w3.org/2000/svg">
              <mask id="mask0_mobile_sticky" style={{ maskType: 'luminance' }} maskUnits="userSpaceOnUse" x="0" y="0" width="91" height="23">
                <path d="M91 0H0V23H91V0Z" fill="white"/>
              </mask>
              <g mask="url(#mask0_mobile_sticky)">
                <path d="M13.124 17.6301C13.124 19.4017 12.5138 20.7388 11.2977 21.6416C10.0815 22.5444 8.33247 23 6.05491 23C4.8173 23 3.74297 22.9361 2.82764 22.8041C1.91231 22.6721 0.979791 22.4337 0.0300812 22.0802V17.5109C0.923923 17.8984 1.90371 18.222 2.96945 18.4733C4.03518 18.7246 4.98489 18.8523 5.81854 18.8523C7.06479 18.8523 7.68791 18.5712 7.68791 18.0048C7.68791 17.7153 7.51171 17.4513 7.16363 17.2256C6.81556 16.9956 5.80136 16.5527 4.12113 15.8884C2.59128 15.2666 1.51695 14.5598 0.911029 13.7634C0.300812 12.9714 0 11.9663 0 10.7484C0 9.21108 0.59733 8.01447 1.79628 7.15853C2.99523 6.30259 4.68837 5.87244 6.87573 5.87244C7.97581 5.87244 9.00718 5.9917 9.97406 6.23017C10.941 6.46864 11.9465 6.81785 12.9865 7.27347L11.4266 10.9528C10.6617 10.6121 9.84944 10.3225 8.99859 10.0841C8.14342 9.8456 7.44727 9.7264 6.90576 9.7264C5.96465 9.7264 5.49197 9.95634 5.49197 10.412C5.49197 10.6931 5.65527 10.9358 5.98615 11.136C6.31705 11.3361 7.26675 11.7406 8.8353 12.3538C10.0041 12.8308 10.8765 13.2993 11.448 13.7549C12.0239 14.2106 12.445 14.7514 12.7158 15.3689C12.9865 15.9863 13.1197 16.7401 13.1197 17.6216L13.124 17.6301Z" fill="white"/>
                <path d="M22.6125 18.4903C23.386 18.4903 24.3142 18.2986 25.3971 17.9196V22.0802C24.6193 22.4123 23.8845 22.6465 23.1797 22.7871C22.4793 22.9276 21.6542 23 20.7131 23C18.7793 23 17.3826 22.5316 16.5318 21.5904C15.6766 20.6536 15.2512 19.2099 15.2512 17.2639V10.4503H13.2314V8.12944L15.7926 6.33661L17.2795 2.86169H21.0482V6.17477H25.1436V10.4503H21.0482V16.8849C21.0482 17.9537 21.5682 18.4903 22.6082 18.4903H22.6125Z" fill="white"/>
                <path d="M37.6958 22.7105L36.5914 20.5216H36.4754C35.6976 21.4755 34.9112 22.127 34.1033 22.4763C33.2997 22.8255 32.2555 23 30.9791 23C29.4063 23 28.173 22.5316 27.2663 21.599C26.3638 20.6664 25.9126 19.3506 25.9126 17.6599C25.9126 15.9693 26.5314 14.5896 27.7691 13.7251C29.0067 12.8649 30.7987 12.3794 33.145 12.273L35.9297 12.1835V11.9493C35.9297 10.5866 35.2507 9.90524 33.897 9.90524C32.6809 9.90524 31.1338 10.3141 29.2559 11.1317L27.5929 7.36722C29.5353 6.37497 31.9933 5.87671 34.9585 5.87671C37.0985 5.87671 38.7573 6.40055 39.9305 7.45238C41.1036 8.50421 41.6923 9.9734 41.6923 11.8599V22.7019H37.7002L37.6958 22.7105ZM33.4243 18.9715C34.1205 18.9715 34.7178 18.7544 35.212 18.3157C35.7062 17.8771 35.9554 17.3107 35.9554 16.6081V15.322L34.6319 15.3817C32.7367 15.4498 31.7913 16.1396 31.7913 17.4555C31.7913 18.469 32.3371 18.9715 33.4243 18.9715Z" fill="white"/>
                <path d="M55.8481 17.6301C55.8481 19.4017 55.2379 20.7388 54.0218 21.6416C52.8056 22.5444 51.0566 23 48.779 23C47.5414 23 46.4671 22.9361 45.5518 22.8041C44.6407 22.6721 43.7039 22.4337 42.7542 22.0802V17.5109C43.6481 17.8984 44.6278 18.222 45.6936 18.4733C46.7593 18.7246 47.709 18.8523 48.5427 18.8523C49.7889 18.8523 50.412 18.5712 50.412 18.0048C50.412 17.7153 50.2358 17.4513 49.8878 17.2256C49.5397 16.9956 48.5255 16.5527 46.8452 15.8884C45.3154 15.2666 44.2411 14.5598 43.6351 13.7634C43.0249 12.9714 42.7241 11.9663 42.7241 10.7484C42.7241 9.21108 43.3214 8.01447 44.5204 7.15853C45.7193 6.30259 47.4125 5.87244 49.5999 5.87244C50.6999 5.87244 51.7313 5.9917 52.6982 6.23017C53.6651 6.46864 54.6707 6.81785 55.7106 7.27347L54.1507 10.9528C53.3857 10.6121 52.5736 10.3225 51.7184 10.0841C50.8632 9.8456 50.1671 9.7264 49.6256 9.7264C48.6845 9.7264 48.2118 9.95634 48.2118 10.412C48.2118 10.6931 48.3751 10.9358 48.706 11.136C49.0326 11.3361 49.9823 11.7406 51.5551 12.3538C52.724 12.8308 53.5963 13.2993 54.1679 13.7549C54.7437 14.2106 55.1648 14.7514 55.4356 15.3689C55.7063 15.9863 55.8396 16.7401 55.8396 17.6216L55.8481 17.6301Z" fill="white"/>
                <path d="M66.9009 22.7104V13.691C66.9009 11.4723 66.2389 10.3651 64.9108 10.3651C63.9701 10.3651 63.2734 10.7569 62.8269 11.5404C62.3799 12.324 62.1564 13.6228 62.1564 15.4455V22.7147H56.3979V0H62.1564V3.22366C62.1564 4.68432 62.079 6.34514 61.9198 8.21459H62.1865C62.7365 7.35865 63.3894 6.75392 64.1459 6.40471C64.9023 6.05556 65.7787 5.88093 66.7803 5.88093C68.6452 5.88093 70.0978 6.41324 71.1335 7.47786C72.1692 8.54248 72.6891 10.0329 72.6891 11.9493V22.7062H66.9009V22.7104Z" fill="white"/>
                <path d="M82.5172 18.4903C83.2907 18.4903 84.2189 18.2986 85.3018 17.9196V22.0802C84.5283 22.4123 83.7889 22.6465 83.0842 22.7871C82.3841 22.9276 81.5588 23 80.6176 23C78.6838 23 77.2875 22.5316 76.4367 21.5904C75.5813 20.6536 75.1559 19.2099 75.1559 17.2639V10.4503H73.1362V8.12944L75.6973 6.33661L77.184 2.86169H80.9531V6.17477H85.0481V10.4503H80.9531V16.8849C80.9531 17.9537 81.473 18.4903 82.5126 18.4903H82.5172Z" fill="white"/>
                <path d="M90.9999 21.7864C90.9999 22.4549 90.57 23 90.0416 23H87.807C87.2786 23 86.8486 22.4549 86.8486 21.7864V20.0319C86.8486 19.3633 87.2786 18.8182 87.807 18.8182H90.0416C90.57 18.8182 90.9999 19.3633 90.9999 20.0319V21.7864Z" fill="white"/>
              </g>
            </svg>
          </div>

          {/* Content Overlay at Bottom */}
          <div className="absolute bottom-20 left-0 right-0 p-4 z-40">
            {/* Tags and Stats Row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#6C60FF] text-white border-0 px-3 py-1.5 text-base">
                  {memoryData.category?.name || 'Personal'}
                </Badge>
                {memoryData.sub_category?.name && (
                  <Badge className="bg-[#FEC53D] text-[#364153] border-0 px-3 py-1.5 text-base">
                    {memoryData.sub_category.name}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-white text-base">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-5 h-5" />
                  <span>{memoryData.likes_count || 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-5 h-5" />
                  <span>{memoryData.comments_count || 0}</span>
                </div>
                {/* Share button */}
                <div className="relative" ref={mobileShareMenuRef}>
                  <button
                    onClick={() => setShowMobileShareMenu(!showMobileShareMenu)}
                    className="flex items-center gap-1.5"
                  >
                    <Share2 className="w-5 h-5" />
                    <span>{memoryData.shares_count || 0}</span>
                  </button>
                  {showMobileShareMenu && (
                    <div className="absolute top-full right-0 mt-2 w-52 py-1.5 z-50 overflow-hidden" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.10)' }}>
                      <button onClick={() => { handleCopyLink(); setShowMobileShareMenu(false); }} className="w-full px-4 py-2.5 text-left text-base font-medium text-[#101828] hover:bg-black/5 flex items-center gap-3">
                        <Copy className="w-4 h-4 text-gray-600 shrink-0" />
                        Copy Link
                      </button>
                      <button onClick={() => { handleShareLinkedIn(); setShowMobileShareMenu(false); }} className="w-full px-4 py-2.5 text-left text-base font-medium text-[#101828] hover:bg-black/5 flex items-center gap-3">
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="24" height="24" rx="4" fill="#0A66C2"/>
                          <path d="M7.5 10H5V19H7.5V10ZM6.25 8.75C5.42 8.75 4.75 8.08 4.75 7.25C4.75 6.42 5.42 5.75 6.25 5.75C7.08 5.75 7.75 6.42 7.75 7.25C7.75 8.08 7.08 8.75 6.25 8.75ZM19 19H16.5V14.25C16.5 12.87 15.38 11.75 14 11.75C12.62 11.75 11.5 12.87 11.5 14.25V19H9V10H11.5V11.34C12.18 10.52 13.22 10 14.38 10C16.93 10 19 12.07 19 14.62V19Z" fill="white"/>
                        </svg>
                        Share on Linkedin
                      </button>
                      <button onClick={() => { handleShareFacebook(); setShowMobileShareMenu(false); }} className="w-full px-4 py-2.5 text-left text-base font-medium text-[#101828] hover:bg-black/5 flex items-center gap-3">
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="24" height="24" rx="4" fill="#1877F2"/>
                          <path d="M16 8H13.5C12.95 8 12.5 8.45 12.5 9V11H16L15.5 13.5H12.5V20H10V13.5H8V11H10V9C10 7.34 11.34 6 13 6H16V8Z" fill="white"/>
                        </svg>
                        Share on Facebook
                      </button>
                      <button onClick={() => { handleShareX(); setShowMobileShareMenu(false); }} className="w-full px-4 py-2.5 text-left text-base font-medium text-[#101828] hover:bg-black/5 flex items-center gap-3">
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="black">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Share on X
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-white mb-3">
              {memoryData.title}
            </h1>

            {/* Location and Date */}
            <div className="flex items-center gap-4 text-white/90 text-base mb-2">
              {memoryData.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-5 h-5" />
                  <span>{memoryData.location}</span>
                </div>
              )}
              {formatDateRange() && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-5 h-5" />
                  <span>{formatDateRange()}</span>
                </div>
              )}
            </div>

            {/* Author Info */}
            <div className="flex items-center gap-3 mb-2">
              <Avatar className="h-10 w-10 border-2 border-white/30">
                <AvatarImage src={memoryData.user?.profile_image} />
                <AvatarFallback className="bg-[#6C60FF] text-white text-sm">
                  {memoryData.user?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-white text-base">Author: {' '}
                <span
                  className="font-semibold cursor-pointer underline"
                  onClick={() => setShowAuthorModal(true)}
                >
                  {memoryData.user?.name}
                </span>
              </span>
            </div>

            {/* Author Modal */}
            {showAuthorModal && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setShowAuthorModal(false)}>
                <div className="absolute inset-0 bg-black/20" />
                <div
                  className="relative w-80 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header with user info */}
                  <div className="p-4 flex items-start gap-3">
                    <Avatar className="h-14 w-14 border-2 border-gray-200">
                      <AvatarImage src={memoryData.user?.profile_image} />
                      <AvatarFallback className="bg-[#6C60FF] text-white text-lg">
                        {memoryData.user?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-lg">{memoryData.user?.name}</p>
                      <p className="text-gray-500 text-sm">{memoryData.location || 'Location not set'}</p>
                    </div>
                    <button
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => setShowAuthorModal(false)}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="px-4 pb-3">
                    <div className="flex items-center justify-between py-2 border-t border-b border-white">
                      <span className="text-gray-600 text-sm">Total Campaigns</span>
                      <span className="font-semibold text-gray-900">{memoryData.user?.memories_count || sortedPosts.length}</span>
                    </div>
                    <p className="text-gray-500 text-sm mt-2">Connect</p>
                  </div>

                  {/* Action buttons */}
                  <div className="px-4 pb-4 flex items-center gap-3 flex-wrap">
                    <button className="flex items-center gap-2 px-8 py-2 border border-gray-300 rounded-full text-sm text-[#0A0A0A] bg-white/70" onClick={() => window.location.href = `mailto:${memoryData.user?.email || ''}`}>
                      <Mail className="w-4 h-4 text-[#0A0A0A]" />
                      Send Email
                    </button>
                    {memoryData.user?.tiktok_url && (
                      <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-full bg-white/70" onClick={() => window.open(memoryData.user?.tiktok_url, '_blank')}>
                        <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10.4375 0H7.96875V10.8889C7.96875 12.0741 7.03125 13.037 5.84375 13.037C4.65625 13.037 3.71875 12.0741 3.71875 10.8889C3.71875 9.7037 4.65625 8.74074 5.84375 8.74074C6.03125 8.74074 6.21875 8.74074 6.40625 8.8V6.2963C6.21875 6.2963 6.03125 6.2963 5.84375 6.2963C3.34375 6.2963 1.25 8.44444 1.25 11C1.25 13.5556 3.34375 15.7037 5.84375 15.7037C8.34375 15.7037 10.4375 13.5556 10.4375 11V5.33333C11.375 6 12.5 6.2963 13.625 6.2963V3.79259C11.9375 3.79259 10.4375 2.37037 10.4375 0Z" fill="black"/>
                        </svg>
                      </button>
                    )}
                    {memoryData.user?.instagram_url && (
                      <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-full bg-white/70" onClick={() => window.open(memoryData.user?.instagram_url, '_blank')}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8 1.44062C10.1375 1.44062 10.3906 1.44062 11.2312 1.48438C12.0094 1.52813 12.4344 1.65938 12.7094 1.76875C13.0781 1.91875 13.3469 2.1 13.6281 2.38125C13.9094 2.6625 14.0906 2.93125 14.2406 3.3C14.35 3.575 14.4812 4 14.525 4.77813C14.5687 5.61875 14.5687 5.87188 14.5687 8.00938C14.5687 10.1469 14.5687 10.4 14.525 11.2406C14.4812 12.0187 14.35 12.4437 14.2406 12.7187C14.0906 13.0875 13.9094 13.3562 13.6281 13.6375C13.3469 13.9187 13.0781 14.1 12.7094 14.25C12.4344 14.3594 12.0094 14.4906 11.2312 14.5344C10.3906 14.5781 10.1375 14.5781 8 14.5781C5.8625 14.5781 5.60938 14.5781 4.76875 14.5344C3.99063 14.4906 3.56563 14.3594 3.29063 14.25C2.92188 14.1 2.65313 13.9187 2.37188 13.6375C2.09063 13.3562 1.90938 13.0875 1.75938 12.7187C1.65 12.4437 1.51875 12.0187 1.475 11.2406C1.43125 10.4 1.43125 10.1469 1.43125 8.00938C1.43125 5.87188 1.43125 5.61875 1.475 4.77813C1.51875 4 1.65 3.575 1.75938 3.3C1.90938 2.93125 2.09063 2.6625 2.37188 2.38125C2.65313 2.1 2.92188 1.91875 3.29063 1.76875C3.56563 1.65938 3.99063 1.52813 4.76875 1.48438C5.60938 1.44062 5.8625 1.44062 8 1.44062ZM8 0C5.82188 0 5.55313 0 4.7 0.04375C3.85 0.0875 3.26875 0.21875 2.7625 0.4125C2.23438 0.61875 1.7875 0.896875 1.34375 1.34375C0.896875 1.7875 0.61875 2.23438 0.4125 2.7625C0.21875 3.26875 0.0875 3.85 0.04375 4.7C0 5.55313 0 5.82188 0 8C0 10.1781 0 10.4469 0.04375 11.3C0.0875 12.15 0.21875 12.7312 0.4125 13.2375C0.61875 13.7656 0.896875 14.2125 1.34375 14.6562C1.7875 15.1 2.23438 15.3781 2.7625 15.5875C3.26875 15.7812 3.85 15.9125 4.7 15.9562C5.55313 16 5.82188 16 8 16C10.1781 16 10.4469 16 11.3 15.9562C12.15 15.9125 12.7312 15.7812 13.2375 15.5875C13.7656 15.3781 14.2125 15.1 14.6562 14.6562C15.1 14.2125 15.3781 13.7656 15.5875 13.2375C15.7812 12.7312 15.9125 12.15 15.9562 11.3C16 10.4469 16 10.1781 16 8C16 5.82188 16 5.55313 15.9562 4.7C15.9125 3.85 15.7812 3.26875 15.5875 2.7625C15.3781 2.23438 15.1 1.7875 14.6562 1.34375C14.2125 0.9 13.7656 0.621875 13.2375 0.4125C12.7312 0.21875 12.15 0.0875 11.3 0.04375C10.4469 0 10.1781 0 8 0Z" fill="black"/>
                          <path d="M8 3.89062C5.73125 3.89062 3.89062 5.73125 3.89062 8C3.89062 10.2687 5.73125 12.1094 8 12.1094C10.2687 12.1094 12.1094 10.2687 12.1094 8C12.1094 5.73125 10.2687 3.89062 8 3.89062ZM8 10.6656C6.52813 10.6656 5.33438 9.47188 5.33438 8C5.33438 6.52813 6.52813 5.33438 8 5.33438C9.47188 5.33438 10.6656 6.52813 10.6656 8C10.6656 9.47188 9.47188 10.6656 8 10.6656Z" fill="black"/>
                          <path d="M12.2719 4.68438C12.7656 4.68438 13.1656 4.28438 13.1656 3.79063C13.1656 3.29688 12.7656 2.89688 12.2719 2.89688C11.7781 2.89688 11.3781 3.29688 11.3781 3.79063C11.3781 4.28438 11.7781 4.68438 12.2719 4.68438Z" fill="black"/>
                        </svg>
                      </button>
                    )}
                    {memoryData.user?.linkedin_url && (
                      <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-full bg-white/70" onClick={() => window.open(memoryData.user?.linkedin_url, '_blank')}>
                        <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <g clipPath="url(#clip0_linkedin_modal)">
                            <path d="M0 1.39417C0 0.990126 0.146401 0.656793 0.439189 0.394175C0.731978 0.131545 1.11262 0.000236511 1.58108 0.000236511C2.04119 0.000236511 2.41344 0.129521 2.69788 0.388115C2.99066 0.654781 3.13707 1.00225 3.13707 1.43054C3.13707 1.81842 2.99486 2.14164 2.71042 2.40023C2.41764 2.6669 2.03282 2.80023 1.55598 2.80023H1.54344C1.08333 2.80023 0.711072 2.6669 0.426641 2.40023C0.142209 2.13357 0 1.79821 0 1.39417ZM0.163127 12.0002V3.90326H2.94884V12.0002H0.163127ZM4.49228 12.0002H7.27799V7.47901C7.27799 7.19618 7.31146 6.97799 7.37838 6.82447C7.49549 6.54972 7.67326 6.31739 7.91168 6.1275C8.1501 5.9376 8.44916 5.84265 8.80888 5.84265C9.74582 5.84265 10.2143 6.45275 10.2143 7.67295V12.0002H13V7.3578C13 6.16184 12.7072 5.25477 12.1216 4.63659C11.536 4.01841 10.7622 3.70932 9.80019 3.70932C8.72104 3.70932 7.88031 4.15781 7.27799 5.05477V5.07902H7.26544L7.27799 5.05477V3.90326H4.49228C4.509 4.16184 4.51737 4.96588 4.51737 6.31538C4.51737 7.66487 4.509 9.55981 4.49228 12.0002Z" fill="black"/>
                          </g>
                          <defs>
                            <clipPath id="clip0_linkedin_modal">
                              <rect width="13" height="12" fill="white"/>
                            </clipPath>
                          </defs>
                        </svg>
                      </button>
                    )}
                    {memoryData.user?.facebook_url && (
                      <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-full bg-white/70" onClick={() => window.open(memoryData.user?.facebook_url, '_blank')}>
                        <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10.71 3.76834H12.0417V1.51584C11.397 1.44879 10.7491 1.41569 10.1009 1.41667C8.17421 1.41667 6.85671 2.5925 6.85671 4.74584V6.60167H4.68213V9.12334H6.85671V15.5833H9.46338V9.12334H11.6309L11.9567 6.60167H9.46338V4.99375C9.46338 4.25 9.66171 3.76834 10.71 3.76834Z" fill="black"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Memory Cards - Vertical Stack overlapping header */}
        <div className="relative px-4 pb-4 -mt-20 space-y-4 z-30">
          {/* Timeline Info - outside header so play/pause button cannot interfere */}
          <div className="flex items-center justify-between">
            <div className="text-white text-lg">
              <span className="font-semibold">Timeline</span>
              <span className="mx-2 text-white/70">•</span>
              <span className="text-white/80">{totalMomentsCount} moments</span>
            </div>
            <button
              className="px-5 py-2 bg-white text-gray-800 text-base font-medium rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                if (mobileFirstContentRef.current) {
                  mobileFirstContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              Continue
            </button>
          </div>
          <div ref={mobileFirstContentRef} />
          {renderWidgets(topWidgetList, false)}
          {publishedTimelineItems.length > 0 ? (
            publishedTimelineItems.map((item: any, combinedIndex: number) => {
              if (item.type === 'linked') {
                const lm = (memoryData?.linked_memories || []).find((l: any) => String(l.id) === item.id);
                if (!lm) return null;
                const lmDateRange = lm.min_uploaded_img_date
                  ? lm.min_uploaded_img_date === lm.max_uploaded_img_date
                    ? new Date(lm.min_uploaded_img_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : `${new Date(lm.min_uploaded_img_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(lm.max_uploaded_img_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : '';
                return (
                  <div key={`lm-${lm.id}`} className="w-full rounded-2xl overflow-hidden">
                    <MemoryCard
                      image={lm.cover_image || lm.last_update_img || null}
                      title={lm.title || 'Untitled'}
                      dateRange={lmDateRange}
                      location={typeof lm.location === 'string' ? lm.location : (lm.location?.formatted || '')}
                      category={lm.category?.name || lm.category || ''}
                      photosCount={lm.posts_count || 0}
                      imagesCount={lm.posts_count || 0}
                      published={lm.published}
                      fullName={lm.user?.name || memoryData?.user?.name}
                      avatar={lm.user?.profile_image || memoryData?.user?.profile_image}
                      profileColor={lm.user?.profile_color || memoryData?.user?.profile_color}
                      tags={lm.is_car ? carLinkedMemoryTags(lm) : (Array.isArray(lm.tags) ? lm.tags : [])}
                      label={lm.is_car ? carLinkedMemoryLabel(lm) : (lm.sub_category?.name || '')}
                      contributors={Array.isArray(lm.collaborators) ? lm.collaborators.map((c: any) => ({ id: c.id || c.user_id, name: c.name || c.user?.name || '', avatar: c.profile_image || c.user?.profile_image || '', profileColor: c.profile_color || c.user?.profile_color || '' })) : []}
                      whiteFooter={true}
                      onClick={() => handleLinkedMemoryClick(lm)}
                    />
                  </div>
                );
              }
              const postIndex = sortedPosts.findIndex((p: any) => String(p.id) === item.id);
              if (postIndex === -1) return null;
              const post = sortedPosts[postIndex];
              const index = postIndex;
              const docusignDoc = memoryData?.docusign_documents?.[post.id?.toString()];
              const authorName = memoryData?.user?.name || 'Unknown';
              const authorAvatar = memoryData?.user?.profile_image;
              const initials = authorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
              return (
                <React.Fragment key={post.id}>
                  <div
                    ref={(el) => { mobileMemoryCardRefs.current[index] = el; }}
                    data-mobile-index={index}
                    className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all duration-200 ${
                      mobileActiveMemoryIndex === index
                        ? 'border-2 border-[#6C60FF]'
                        : 'border border-gray-100'
                    }`}
                  >
                    <PublishedPostCard
                      post={post}
                      index={index}
                      memoryData={memoryData}
                      onImageClick={handleImageClick}
                      onCommentClick={handleCommentClick}
                    />
                  </div>
                  {docusignDoc && (
                    <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white hover:shadow-md transition-all duration-200">
                      <div className="aspect-[4/3] cursor-pointer overflow-hidden" onClick={() => handlePdfDocumentView(docusignDoc)}>
                        <PdfThumbnail url={docusignDoc.signed_document_url} className="w-full h-full" />
                      </div>
                      <div className="space-y-3 p-[22px]">
                        <div className="flex items-center gap-3">
                          <div className="h-[30px] w-[30px] rounded-full overflow-hidden bg-gradient-to-br from-[#6C60FF] to-purple-600 flex items-center justify-center flex-shrink-0">
                            {authorAvatar ? <img src={authorAvatar} alt={authorName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <span className="text-white text-xs font-medium">{initials}</span>}
                          </div>
                          <p className="font-medium text-[#364153] text-lg flex-1 truncate">{authorName}</p>
                          <div className="flex items-center gap-3 text-[15px] text-gray-600">
                            <span className="flex items-center gap-1"><Heart className="h-5 w-5" />0</span>
                            <span className="flex items-center gap-1"><MessageSquare className="h-5 w-5" />0</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[#6C60FF] flex-shrink-0" />
                          <p className="text-sm text-[#364153] truncate flex-1">{docusignDoc.document_name}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {renderWidgets(widgetsAfter(post.id), false)}
                </React.Fragment>
              );
            })
          ) : (
            <div className="text-center py-12 text-gray-500 bg-white rounded-xl">
              <p>No moments to display</p>
            </div>
          )}

          {/* Pinned-to-bottom widgets — render after the whole timeline */}
          {renderWidgets(bottomWidgetList, false)}

          {/* E-Business Card - Mobile */}
          {!!memoryData?.user?.is_business && (
            <div className="mt-10 mx-2">
              <div className="flex flex-col items-center text-center">
                <Avatar className="w-14 h-14 mb-2">
                  <AvatarImage src={memoryData?.user?.profile_image} className="object-cover" />
                  <AvatarFallback className="bg-[#6C60FF] text-white text-sm">
                    {memoryData?.user?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <p className="text-base font-bold text-gray-900">{memoryData?.user?.name}</p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-1 flex-wrap">
                  {memoryData?.user?.email && (
                    <a href={`mailto:${memoryData.user.email}`} className="flex items-center gap-1 hover:text-[#6C60FF] transition-colors">
                      <Mail className="w-3 h-3" />
                      {memoryData.user.email}
                    </a>
                  )}
                  {memoryData?.user?.phone_number && (
                    <a href={`tel:${memoryData.user.phone_number}`} className="flex items-center gap-1 hover:text-[#6C60FF] transition-colors">
                      <Phone className="w-3 h-3" />
                      {memoryData.user.phone_number}
                    </a>
                  )}
                </div>
                {memoryData?.user?.website && (
                  <a href={memoryData.user.website} target="_blank" rel="noopener noreferrer" className="text-sm text-[#6C60FF] hover:underline mb-3">
                    {displayWebsite(memoryData.user.website)}
                  </a>
                )}
                <div className="flex items-center gap-3 mt-2 mb-3">
                  {[
                    { url: memoryData?.user?.instagram_url, src: '/social-instagram.png', alt: 'Instagram' },
                    { url: memoryData?.user?.linkedin_url,  src: '/social-linkedin.png',  alt: 'LinkedIn'  },
                    { url: memoryData?.user?.tiktok_url,    src: '/social-tiktok.png',    alt: 'TikTok'    },
                    { url: memoryData?.user?.facebook_url,  src: '/social-facebook.png',  alt: 'Facebook'  },
                  ].filter(s => typeof s.url === 'string' && s.url.trim().length > 0).map(s => (
                    <a key={s.alt} href={s.url.trim()} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                      <img src={s.src} alt={s.alt} className="w-6 h-6 object-contain" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Footer */}
        <div className="py-6 text-center">
          <p className="text-sm text-gray-500">
            Powered by <span className="font-semibold text-[#6C60FF]">Stasht</span>
          </p>
        </div>
      </div>

      {/* DESKTOP TWO-COLUMN LAYOUT */}
      <div className="hidden lg:block h-screen bg-[#F8F8FA] overflow-y-hidden">
        {/* Main Two-Column Container */}
        <div className="relative max-w-4xl mx-auto px-6 md:px-8 py-6 h-full">
          {/* Back to Campaigns - show for authenticated users, sub-memory, or when opened from an author page */}
          {(isAuthenticated || memoryHistory.length > 0 || cameFromAuthorPage) && (
            <button
              className="absolute top-6 -left-2 -translate-x-full flex items-center gap-1.5 border border-gray-500 rounded-full px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 bg-white transition-colors whitespace-nowrap z-10"
              onClick={handleBackToCampaigns}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Campaigns
            </button>
          )}
          <div className="flex flex-col lg:flex-row gap-12 h-full">

            {/* LEFT SIDEBAR */}
            <div className="lg:w-[350px] lg:flex-shrink-0 flex flex-col h-full overflow-hidden">
              <div className="flex flex-col h-full">
                {/* Tags and Stats Row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    {/* Category Badge */}
                    <Badge className="bg-[#6C60FF] text-white border-0 px-3 py-1.5 text-sm rounded-2xl">
                      {memoryData.category?.name}
                    </Badge>
                    {/* Year Badge */}
                    {(memoryData.sub_category?.name) && (
                      <Badge className="bg-[#FEC53D] text-[#364153] border-0 px-3 py-1.5 text-sm rounded-2xl">
                        {memoryData.sub_category?.name}
                      </Badge>
                    )}
                  </div>
                  {/* Likes and Comments */}
                  <div className="flex items-center gap-3 text-gray-500 text-base">
                    <div className="flex items-center gap-1">
                      <Heart className="w-5 h-5" />
                      <span>{memoryData.likes_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-5 h-5" />
                      <span>{memoryData.comments_count || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                  {memoryData.title}
                </h1>

                {/* Location and Date */}
                <div className="flex items-center gap-4 text-gray-500 text-base mb-4">
                  {memoryData.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-5 h-5" />
                      <span>{memoryData.location}</span>
                    </div>
                  )}
                  {formatDateRange() && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-5 h-5" />
                      <span>{formatDateRange()}</span>
                    </div>
                  )}
                </div>

                {/* Author Info */}
                <div className="relative flex items-center justify-between mb-6" onMouseEnter={() => setShowDesktopAuthorModal(true)} onMouseLeave={() => setShowDesktopAuthorModal(false)}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-gray-100">
                      <AvatarImage src={memoryData.user?.profile_image} />
                      <AvatarFallback className="bg-[#6C60FF] text-white text-base">
                        {memoryData.user?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-base"><span className="text-gray-600 font-medium">Author: </span><span className="font-semibold text-gray-900 cursor-pointer underline">{memoryData.user?.name}</span></p>
                    </div>
                  </div>

                  {/* Author Modal - Desktop (hover) */}
                  <div className={`absolute top-10 left-10 z-[9999] ${showDesktopAuthorModal ? 'block' : 'hidden'}`}>
                    <div
                      className="w-80 bg-white/80 backdrop-blur-sm overflow-hidden"
                      style={{ borderRadius: '42px', boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.25)' }}
                    >
                      {/* Header with user info */}
                      <div className="p-4 flex items-start gap-3">
                        <Avatar className="h-14 w-14 border-2 border-gray-200">
                          <AvatarImage src={memoryData.user?.profile_image} />
                          <AvatarFallback className="bg-[#6C60FF] text-white text-lg">
                            {memoryData.user?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-lg">{memoryData.user?.name}</p>
                          <p className="text-gray-500 text-sm">{memoryData.location || 'Location not set'}</p>
                        </div>
                        <button
                          className="text-gray-600 py-2"
                          onClick={(e) => { e.stopPropagation(); setShowDesktopAuthorModal(false); }}
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Stats */}
                      <div className="px-4 pb-3">
                        <div className="flex items-center justify-between py-2 border-t border-b border-white">
                          <span className="text-gray-600 text-sm">Total Campaigns</span>
                          <span className="font-semibold text-gray-900">{memoryData.user?.memories_count || sortedPosts.length}</span>
                        </div>
                        <p className="text-gray-500 text-sm mt-2">Connect</p>
                      </div>

                      {/* Action buttons */}
                      <div className="px-4 pb-4 flex items-center gap-3 flex-wrap">
                        <button className="flex items-center gap-2 px-8 py-2 border border-gray-300 rounded-full text-sm text-[#0A0A0A] bg-white/70" onClick={() => window.location.href = `mailto:${memoryData.user?.email || ''}`}>
                          <Mail className="w-4 h-4 text-[#0A0A0A]" />
                          Send Email
                        </button>
                        {memoryData.user?.tiktok_url && (
                          <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-full bg-white/70" onClick={() => window.open(memoryData.user?.tiktok_url, '_blank')}>
                            <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M10.4375 0H7.96875V10.8889C7.96875 12.0741 7.03125 13.037 5.84375 13.037C4.65625 13.037 3.71875 12.0741 3.71875 10.8889C3.71875 9.7037 4.65625 8.74074 5.84375 8.74074C6.03125 8.74074 6.21875 8.74074 6.40625 8.8V6.2963C6.21875 6.2963 6.03125 6.2963 5.84375 6.2963C3.34375 6.2963 1.25 8.44444 1.25 11C1.25 13.5556 3.34375 15.7037 5.84375 15.7037C8.34375 15.7037 10.4375 13.5556 10.4375 11V5.33333C11.375 6 12.5 6.2963 13.625 6.2963V3.79259C11.9375 3.79259 10.4375 2.37037 10.4375 0Z" fill="black"/>
                            </svg>
                          </button>
                        )}
                        {memoryData.user?.instagram_url && (
                          <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-full bg-white/70" onClick={() => window.open(memoryData.user?.instagram_url, '_blank')}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M8 1.44062C10.1375 1.44062 10.3906 1.44062 11.2312 1.48438C12.0094 1.52813 12.4344 1.65938 12.7094 1.76875C13.0781 1.91875 13.3469 2.1 13.6281 2.38125C13.9094 2.6625 14.0906 2.93125 14.2406 3.3C14.35 3.575 14.4812 4 14.525 4.77813C14.5687 5.61875 14.5687 5.87188 14.5687 8.00938C14.5687 10.1469 14.5687 10.4 14.525 11.2406C14.4812 12.0187 14.35 12.4437 14.2406 12.7187C14.0906 13.0875 13.9094 13.3562 13.6281 13.6375C13.3469 13.9187 13.0781 14.1 12.7094 14.25C12.4344 14.3594 12.0094 14.4906 11.2312 14.5344C10.3906 14.5781 10.1375 14.5781 8 14.5781C5.8625 14.5781 5.60938 14.5781 4.76875 14.5344C3.99063 14.4906 3.56563 14.3594 3.29063 14.25C2.92188 14.1 2.65313 13.9187 2.37188 13.6375C2.09063 13.3562 1.90938 13.0875 1.75938 12.7187C1.65 12.4437 1.51875 12.0187 1.475 11.2406C1.43125 10.4 1.43125 10.1469 1.43125 8.00938C1.43125 5.87188 1.43125 5.61875 1.475 4.77813C1.51875 4 1.65 3.575 1.75938 3.3C1.90938 2.93125 2.09063 2.6625 2.37188 2.38125C2.65313 2.1 2.92188 1.91875 3.29063 1.76875C3.56563 1.65938 3.99063 1.52813 4.76875 1.48438C5.60938 1.44062 5.8625 1.44062 8 1.44062ZM8 0C5.82188 0 5.55313 0 4.7 0.04375C3.85 0.0875 3.26875 0.21875 2.7625 0.4125C2.23438 0.61875 1.7875 0.896875 1.34375 1.34375C0.896875 1.7875 0.61875 2.23438 0.4125 2.7625C0.21875 3.26875 0.0875 3.85 0.04375 4.7C0 5.55313 0 5.82188 0 8C0 10.1781 0 10.4469 0.04375 11.3C0.0875 12.15 0.21875 12.7312 0.4125 13.2375C0.61875 13.7656 0.896875 14.2125 1.34375 14.6562C1.7875 15.1 2.23438 15.3781 2.7625 15.5875C3.26875 15.7812 3.85 15.9125 4.7 15.9562C5.55313 16 5.82188 16 8 16C10.1781 16 10.4469 16 11.3 15.9562C12.15 15.9125 12.7312 15.7812 13.2375 15.5875C13.7656 15.3781 14.2125 15.1 14.6562 14.6562C15.1 14.2125 15.3781 13.7656 15.5875 13.2375C15.7812 12.7312 15.9125 12.15 15.9562 11.3C16 10.4469 16 10.1781 16 8C16 5.82188 16 5.55313 15.9562 4.7C15.9125 3.85 15.7812 3.26875 15.5875 2.7625C15.3781 2.23438 15.1 1.7875 14.6562 1.34375C14.2125 0.9 13.7656 0.621875 13.2375 0.4125C12.7312 0.21875 12.15 0.0875 11.3 0.04375C10.4469 0 10.1781 0 8 0Z" fill="black"/>
                              <path d="M8 3.89062C5.73125 3.89062 3.89062 5.73125 3.89062 8C3.89062 10.2687 5.73125 12.1094 8 12.1094C10.2687 12.1094 12.1094 10.2687 12.1094 8C12.1094 5.73125 10.2687 3.89062 8 3.89062ZM8 10.6656C6.52813 10.6656 5.33438 9.47188 5.33438 8C5.33438 6.52813 6.52813 5.33438 8 5.33438C9.47188 5.33438 10.6656 6.52813 10.6656 8C10.6656 9.47188 9.47188 10.6656 8 10.6656Z" fill="black"/>
                              <path d="M12.2719 4.68438C12.7656 4.68438 13.1656 4.28438 13.1656 3.79063C13.1656 3.29688 12.7656 2.89688 12.2719 2.89688C11.7781 2.89688 11.3781 3.29688 11.3781 3.79063C11.3781 4.28438 11.7781 4.68438 12.2719 4.68438Z" fill="black"/>
                            </svg>
                          </button>
                        )}
                        {memoryData.user?.linkedin_url && (
                          <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-full bg-white/70" onClick={() => window.open(memoryData.user?.linkedin_url, '_blank')}>
                            <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <g clipPath="url(#clip0_linkedin_desktop)">
                                <path d="M0 1.39417C0 0.990126 0.146401 0.656793 0.439189 0.394175C0.731978 0.131545 1.11262 0.000236511 1.58108 0.000236511C2.04119 0.000236511 2.41344 0.129521 2.69788 0.388115C2.99066 0.654781 3.13707 1.00225 3.13707 1.43054C3.13707 1.81842 2.99486 2.14164 2.71042 2.40023C2.41764 2.6669 2.03282 2.80023 1.55598 2.80023H1.54344C1.08333 2.80023 0.711072 2.6669 0.426641 2.40023C0.142209 2.13357 0 1.79821 0 1.39417ZM0.163127 12.0002V3.90326H2.94884V12.0002H0.163127ZM4.49228 12.0002H7.27799V7.47901C7.27799 7.19618 7.31146 6.97799 7.37838 6.82447C7.49549 6.54972 7.67326 6.31739 7.91168 6.1275C8.1501 5.9376 8.44916 5.84265 8.80888 5.84265C9.74582 5.84265 10.2143 6.45275 10.2143 7.67295V12.0002H13V7.3578C13 6.16184 12.7072 5.25477 12.1216 4.63659C11.536 4.01841 10.7622 3.70932 9.80019 3.70932C8.72104 3.70932 7.88031 4.15781 7.27799 5.05477V5.07902H7.26544L7.27799 5.05477V3.90326H4.49228C4.509 4.16184 4.51737 4.96588 4.51737 6.31538C4.51737 7.66487 4.509 9.55981 4.49228 12.0002Z" fill="black"/>
                              </g>
                              <defs>
                                <clipPath id="clip0_linkedin_desktop">
                                  <rect width="13" height="12" fill="white"/>
                                </clipPath>
                              </defs>
                            </svg>
                          </button>
                        )}
                        {memoryData.user?.facebook_url && (
                          <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-full bg-white/70" onClick={() => window.open(memoryData.user?.facebook_url, '_blank')}>
                            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M10.71 3.76834H12.0417V1.51584C11.397 1.44879 10.7491 1.41569 10.1009 1.41667C8.17421 1.41667 6.85671 2.5925 6.85671 4.74584V6.60167H4.68213V9.12334H6.85671V15.5833H9.46338V9.12334H11.6309L11.9567 6.60167H9.46338V4.99375C9.46338 4.25 9.66171 3.76834 10.71 3.76834Z" fill="black"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search Input */}
                <div className="relative mb-6">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search moments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-4 pr-11 py-3 border border-gray-400 rounded-lg bg-transparent text-base focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
                  />
                </div>

                {/* Timeline Section */}
                <div className="bg-transparent rounded-xl border border-gray-100 flex-1 flex flex-col overflow-hidden">
                  {/* Timeline Header */}
                  <div className="flex items-center justify-between pb-4 mb-4 border-b" style={{ borderColor: '#BFBFBF' }}>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">Timeline</h3>
                      <p className="text-base text-gray-500">{totalMomentsCount} moments</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Share Button */}
                      <div className="relative" ref={shareMenuRef}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-gray-200 text-gray-900 bg-white hover:bg-gray-50 text-sm h-9"
                          onClick={() => setShowShareMenu(!showShareMenu)}
                        >
                          <Share2 className="w-4 h-4" />
                          Share
                        </Button>
                        {showShareMenu && (
                          <div className="absolute top-full right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                            <button onClick={handleCopyLink} className="w-full px-3 py-2.5 text-left text-base hover:bg-gray-50 flex items-center gap-2.5">
                              <Link className="w-5 h-5" /> Copy Link
                            </button>
                            <button onClick={handleShareFacebook} className="w-full px-3 py-2.5 text-left text-base hover:bg-gray-50 flex items-center gap-2.5">
                              <Facebook className="w-5 h-5" /> Facebook
                            </button>
                            <button onClick={handleShareX} className="w-full px-3 py-2.5 text-left text-base hover:bg-gray-50 flex items-center gap-2.5">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> X
                            </button>
                            <button onClick={handleShareLinkedIn} className="w-full px-3 py-2.5 text-left text-base hover:bg-gray-50 flex items-center gap-2.5">
                              <Linkedin className="w-5 h-5" /> LinkedIn
                            </button>
                            <div className="border-t border-gray-100 my-1"></div>
                            <button onClick={handleEmbedCode} className="w-full px-3 py-2.5 text-left text-base hover:bg-gray-50 flex items-center gap-2.5">
                              <Code className="w-5 h-5" /> Embed Code
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timeline Items - Scrollable */}
                  <div className="space-y-0 flex-1 overflow-y-auto pr-2">
                    {/* Introduction Item */}
                    <div
                      className="relative pl-8 pb-4 cursor-pointer transition-all duration-200 border-l-2 border-gray-200 ml-3"
                      onClick={() => {
                        // Scroll to the header image
                        if (headerImageRef.current) {
                          headerImageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                    >
                      {/* Timeline Icon */}
                      <div
                        className={`absolute -left-3.5 top-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                          !isHeaderImageScrolled
                            ? 'bg-[#155DFC] text-white'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <svg width="14" height="10" viewBox="0 0 11 7" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8.55556 2.625V0.583333C8.55556 0.2625 8.28056 0 7.94444 0H0.611111C0.275 0 0 0.2625 0 0.583333V6.41667C0 6.7375 0.275 7 0.611111 7H7.94444C8.28056 7 8.55556 6.7375 8.55556 6.41667V4.375L11 6.70833V0.291667L8.55556 2.625Z" fill="currentColor"/>
                        </svg>
                      </div>

                      {/* Content */}
                      <div className={`transition-all duration-200 ${!isHeaderImageScrolled ? 'opacity-100' : 'opacity-70'}`}>
                        <p className={`leading-snug transition-all duration-200 ${
                          !isHeaderImageScrolled
                            ? 'text-xl font-medium text-gray-900'
                            : 'text-base text-gray-700'
                        }`}>
                          Introduction
                        </p>
                        <div className={`flex items-center gap-1 mt-1 text-gray-400 ${!isHeaderImageScrolled ? 'text-base' : 'text-sm'}`}>
                          <span>Now</span>
                        </div>
                      </div>
                    </div>

                    {topWidgetList.map((w: any) => renderSidebarWidgetNode(w, true))}
                    {publishedTimelineItems.map((item: any, combinedSidebarIndex: number) => {
                      const totalItems = publishedTimelineItems.length;
                      if (item.type === 'linked') {
                        const lm = (memoryData?.linked_memories || []).find((l: any) => String(l.id) === item.id);
                        if (!lm) return null;
                        const lmDate = lm.min_uploaded_img_date
                          ? new Date(lm.min_uploaded_img_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '-';
                        const lmLocation = typeof lm.location === 'string' ? lm.location : (lm.location?.formatted || '-');
                        return (
                          <div
                            key={`lm-sidebar-${lm.id}`}
                            className={`relative pl-8 pb-4 cursor-pointer transition-all duration-200 ml-3 ${combinedSidebarIndex === totalItems - 1 ? '' : 'border-l-2 border-gray-200'}`}
                            onClick={() => {
                              const el = document.querySelector(`[data-pub-lm-id="${lm.id}"]`) as HTMLElement | null;
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                          >
                            <div className={`absolute -left-3.5 top-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${activePubLmId === String(lm.id) && isHeaderImageScrolled ? 'bg-[#155DFC] text-white' : 'bg-gray-100 text-gray-400'}`}>
                              <BookOpen className="w-[15px] h-[15px]" />
                            </div>
                            <div>
                              <p className={`line-clamp-2 hover:text-[#6C60FF] cursor-pointer ${activePubLmId === String(lm.id) && isHeaderImageScrolled ? 'text-xl font-medium text-gray-900' : 'text-lg text-[#101828]'}`}>{lm.title || 'Untitled'}</p>
                              <div className="flex items-center gap-1.5 mt-1 text-gray-400 text-sm">
                                <Calendar className="w-4 h-4" />
                                <span>{lmDate}</span>
                                {lmLocation !== '-' && <><MapPin className="w-4 h-4 ml-2" /><span>{lmLocation.length > 17 ? lmLocation.substring(0, 17) + '...' : lmLocation}</span></>}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      const postIndex = sortedPosts.findIndex((p: any) => String(p.id) === item.id);
                      if (postIndex === -1) return null;
                      const post = sortedPosts[postIndex];
                      const index = postIndex;
                      const isActive = activeMemoryIndex === index && isHeaderImageScrolled;
                      const postDate = post.uploaded_at || post.capture_date;
                      const description = post.description || post.title || 'Untitled moment';
                      const postWidgets = widgetsAfter(post.id);
                      const isLastItem = combinedSidebarIndex === totalItems - 1;
                      return (
                        <React.Fragment key={post.id}>
                        <div
                          ref={(el) => { timelineItemRefs.current[index] = el; }}
                          className={`relative pl-8 pb-4 cursor-pointer transition-all duration-200 ml-3 ${
                            (isLastItem && postWidgets.length === 0) ? '' : 'border-l-2 border-gray-200'
                          }`}
                          onClick={() => {
                            const cardElement = memoryCardRefs.current[index];
                            if (cardElement) cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                        >
                          <div className={`absolute -left-3.5 top-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isActive ? 'bg-[#155DFC] text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <svg width="15" height="15" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M5 10C4.30833 10 3.65833 9.86875 3.05 9.60625C2.44167 9.34375 1.9125 8.9875 1.4625 8.5375C1.0125 8.0875 0.65625 7.55833 0.39375 6.95C0.13125 6.34167 0 5.69167 0 5C0 4.30833 0.13125 3.65833 0.39375 3.05C0.65625 2.44167 1.0125 1.9125 1.4625 1.4625C1.9125 1.0125 2.44167 0.65625 3.05 0.39375C3.65833 0.13125 4.30833 0 5 0C5.69167 0 6.34167 0.13125 6.95 0.39375C7.55833 0.65625 8.0875 1.0125 8.5375 1.4625C8.9875 1.9125 9.34375 2.44167 9.60625 3.05C9.86875 3.65833 10 4.30833 10 5C10 5.225 9.9875 5.44583 9.9625 5.6625C9.9375 5.87917 9.89583 6.09167 9.8375 6.3C9.72083 6.16667 9.58542 6.05417 9.43125 5.9625C9.27708 5.87083 9.10833 5.80833 8.925 5.775C8.95 5.65 8.96875 5.52292 8.98125 5.39375C8.99375 5.26458 9 5.13333 9 5C9 3.88333 8.6125 2.9375 7.8375 2.1625C7.0625 1.3875 6.11667 1 5 1C3.88333 1 2.9375 1.3875 2.1625 2.1625C1.3875 2.9375 1 3.88333 1 5C1 6.11667 1.3875 7.0625 2.1625 7.8375C2.9375 8.6125 3.88333 9 5 9C5.425 9 5.83125 8.9375 6.21875 8.8125C6.60625 8.6875 6.9625 8.5125 7.2875 8.2875C7.3875 8.42917 7.51042 8.55417 7.65625 8.6625C7.80208 8.77083 7.95833 8.85417 8.125 8.9125C7.7 9.25417 7.22292 9.52083 6.69375 9.7125C6.16458 9.90417 5.6 10 5 10ZM8.625 8C8.45 8 8.30208 7.93958 8.18125 7.81875C8.06042 7.69792 8 7.55 8 7.375C8 7.2 8.06042 7.05208 8.18125 6.93125C8.30208 6.81042 8.45 6.75 8.625 6.75C8.8 6.75 8.94792 6.81042 9.06875 6.93125C9.18958 7.05208 9.25 7.2 9.25 7.375C9.25 7.55 9.18958 7.69792 9.06875 7.81875C8.94792 7.93958 8.8 8 8.625 8ZM6.65 7.35L4.5 5.2V2.5H5.5V4.8L7.35 6.65L6.65 7.35Z" fill="currentColor"/>
                            </svg>
                          </div>
                          <div className="group/border relative pr-6 transition-all duration-200 opacity-100">
                            <p className={`leading-snug transition-all duration-200 hover:text-[#6C60FF] cursor-pointer ${isActive ? 'text-xl font-medium text-gray-900' : 'text-lg text-[#101828] line-clamp-2'}`}>{description}</p>
                            <div className="flex items-center gap-1.5 mt-1 text-gray-400 text-sm">
                              <Calendar className="w-4 h-4" />
                              <span>{postDate ? new Date(postDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</span>
                              <MapPin className="w-4 h-4 ml-2" />
                              <span>{(post.location || '-').length > 17 ? (post.location || '-').substring(0, 17) + '...' : (post.location || '-')}</span>
                              <button onClick={(e) => { e.stopPropagation(); handleCommentClick(post, index); }} className="flex items-center gap-1.5 ml-2 hover:text-[#6C60FF] transition-colors cursor-pointer">
                                <MessageSquare className="w-4 h-4" />
                                <span>{post.comments_count ?? 0}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                        {postWidgets.map((w: any, wi: number) => renderSidebarWidgetNode(w, !(isLastItem && wi === postWidgets.length - 1)))}
                        </React.Fragment>
                      );
                    })}

                    {/* Pinned-to-bottom widgets — after the whole timeline */}
                    {bottomWidgetList.map((w: any, wi: number) => renderSidebarWidgetNode(w, wi !== bottomWidgetList.length - 1))}

                    {/* E-Business Card - desktop only */}
                    {!!memoryData?.user?.is_business && <div className="mx-3">
                      <div className="h-10" />

                      {/* Avatar + Info */}
                      <div className="flex flex-col items-center text-center">
                        <Avatar className="w-14 h-14 mb-2">
                          <AvatarImage src={memoryData?.user?.profile_image} className="object-cover" />
                          <AvatarFallback className="bg-[#6C60FF] text-white text-sm">
                            {memoryData?.user?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                          </AvatarFallback>
                        </Avatar>

                        <p className="text-base font-bold text-gray-900">{memoryData?.user?.name}</p>

                        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-1 flex-wrap">
                          {memoryData?.user?.email && (
                            <a href={`mailto:${memoryData.user.email}`} className="flex items-center gap-1 hover:text-[#6C60FF] transition-colors">
                              <Mail className="w-3 h-3" />
                              {memoryData.user.email}
                            </a>
                          )}
                          {memoryData?.user?.phone_number && (
                            <a href={`tel:${memoryData.user.phone_number}`} className="flex items-center gap-1 hover:text-[#6C60FF] transition-colors">
                              <Phone className="w-3 h-3" />
                              {memoryData.user.phone_number}
                            </a>
                          )}
                        </div>

                        {memoryData?.user?.website && (
                          <a
                            href={memoryData.user.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[#6C60FF] hover:underline mb-3"
                          >
                            {displayWebsite(memoryData.user.website)}
                          </a>
                        )}

                        {/* Social Icons */}
                        <div className="flex items-center gap-3 mt-2 mb-3">
                          {[
                            { url: memoryData?.user?.instagram_url, src: '/social-instagram.png', alt: 'Instagram' },
                            { url: memoryData?.user?.linkedin_url,  src: '/social-linkedin.png',  alt: 'LinkedIn'  },
                            { url: memoryData?.user?.tiktok_url,    src: '/social-tiktok.png',    alt: 'TikTok'    },
                            { url: memoryData?.user?.facebook_url,  src: '/social-facebook.png',  alt: 'Facebook'  },
                          ].filter(s => typeof s.url === 'string' && s.url.trim().length > 0).map(s => (
                            <a key={s.alt} href={s.url.trim()} target="_blank" rel="noopener noreferrer"
                              className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                            >
                              <img src={s.src} alt={s.alt} className="w-6 h-6 object-contain" />
                            </a>
                          ))}
                        </div>
                      </div>

                    </div>}

                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT CONTENT AREA */}
            <div className="flex flex-col overflow-hidden" style={{ width: '394px', minWidth: '394px' }} ref={rightContentRef}>
              {/* Sticky Timeline Bar - appears after header scrolls out */}
              {isHeaderImageScrolled && (
                <div className="hidden sticky top-0 z-20 bg-white border-b border-gray-200 py-3 px-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-gray-900 text-lg">
                      <span className="font-semibold">Timeline</span>
                      <span className="mx-2 text-gray-400">•</span>
                      <span className="text-gray-500">{totalMomentsCount} moments</span>
                    </div>
                    <button className="px-4 py-2 bg-gray-100 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 transition-colors" onClick={() => { if (firstContentRef.current) firstContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Scrollable Container - Header Image + Memory Cards with Parallax */}
              <div className="flex-1 overflow-y-auto" ref={rightScrollContainerRef}>
                {/* Parallax Container */}
                <div className="relative">
                  {/* Header Image */}
                  <div ref={headerImageRef} className="relative rounded-3xl overflow-hidden mx-2" style={{ height: 'min(800px, calc(100vh - 80px))' }}>
                    {(() => {
                      const coverSrc = memoryData.last_update_img || allPosts[0]?.master_image_link || memoryData?.linked_memories?.[0]?.cover_image;
                      return isYoutubeUrl(coverSrc) ? (
                        <div id="yt-cover-desktop" className="w-full h-full absolute inset-0 overflow-hidden" />
                      ) : isVideoUrl(coverSrc) ? (
                        <div
                          className="absolute inset-0"
                          onMouseEnter={() => setIsCoverVideoHovered(true)}
                          onMouseLeave={() => setIsCoverVideoHovered(false)}
                        >
                          <video
                            ref={coverVideoDesktopRef}
                            src={coverSrc}
                            className="w-full h-full object-cover"
                            playsInline
                            muted
                            preload="metadata"
                            onEnded={() => { setIsCoverVideoPlaying(false); setIsCoverVideoEnded(true); }}
                          />
                          {(isCoverVideoHovered || isCoverVideoEnded) && (
                            <button
                              onClick={handleToggleCoverVideo}
                              className="absolute inset-0 flex items-center justify-center group"
                            >
                              <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-all duration-200 group-hover:bg-black/60 group-hover:scale-110">
                                {isCoverVideoPlaying
                                  ? <Pause className="w-7 h-7 text-white" />
                                  : <Play className="w-7 h-7 text-white ml-0.5" />
                                }
                              </div>
                            </button>
                          )}
                        </div>
                      ) : (
                        <ImageWithFallback
                          src={coverSrc}
                          alt={memoryData.title}
                          className="w-full h-full object-cover"
                        />
                      );
                    })()}
                    {/* Black Gradient Overlay */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: 'linear-gradient(0deg, rgba(0, 0, 0, 0.80) 11.54%, rgba(0, 0, 0, 0.30) 55.77%, rgba(0, 0, 0, 0.00) 100%)' }}
                    />
                    {/* Back Button - Top Left Corner */}
                    {(isAuthenticated || memoryHistory.length > 0 || cameFromAuthorPage) && (
                      <div className="absolute top-4 left-4 z-10">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white/90 backdrop-blur-sm shadow-md border-0 text-gray-700 hover:bg-white"
                          onClick={handleBackToCampaigns}
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          <span className="hidden md:inline">Back to Campaigns</span>
                          <span className="md:hidden">Back</span>
                        </Button>
                      </div>
                    )}
                    {/* Logo - Top Right Corner */}
                    <div className="fixed top-[33px] right-1/4 z-10 opacity-45">
                      <svg width="91" height="23" viewBox="0 0 91 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <mask id="mask0_11053_29716" style={{ maskType: 'luminance' }} maskUnits="userSpaceOnUse" x="0" y="0" width="91" height="23">
                          <path d="M91 0H0V23H91V0Z" fill="white"/>
                        </mask>
                        <g mask="url(#mask0_11053_29716)">
                          <path d="M13.124 17.6301C13.124 19.4017 12.5138 20.7388 11.2977 21.6416C10.0815 22.5444 8.33247 23 6.05491 23C4.8173 23 3.74297 22.9361 2.82764 22.8041C1.91231 22.6721 0.979791 22.4337 0.0300812 22.0802V17.5109C0.923923 17.8984 1.90371 18.222 2.96945 18.4733C4.03518 18.7246 4.98489 18.8523 5.81854 18.8523C7.06479 18.8523 7.68791 18.5712 7.68791 18.0048C7.68791 17.7153 7.51171 17.4513 7.16363 17.2256C6.81556 16.9956 5.80136 16.5527 4.12113 15.8884C2.59128 15.2666 1.51695 14.5598 0.911029 13.7634C0.300812 12.9714 0 11.9663 0 10.7484C0 9.21108 0.59733 8.01447 1.79628 7.15853C2.99523 6.30259 4.68837 5.87244 6.87573 5.87244C7.97581 5.87244 9.00718 5.9917 9.97406 6.23017C10.941 6.46864 11.9465 6.81785 12.9865 7.27347L11.4266 10.9528C10.6617 10.6121 9.84944 10.3225 8.99859 10.0841C8.14342 9.8456 7.44727 9.7264 6.90576 9.7264C5.96465 9.7264 5.49197 9.95634 5.49197 10.412C5.49197 10.6931 5.65527 10.9358 5.98615 11.136C6.31705 11.3361 7.26675 11.7406 8.8353 12.3538C10.0041 12.8308 10.8765 13.2993 11.448 13.7549C12.0239 14.2106 12.445 14.7514 12.7158 15.3689C12.9865 15.9863 13.1197 16.7401 13.1197 17.6216L13.124 17.6301Z" fill="white"/>
                          <path d="M22.6125 18.4903C23.386 18.4903 24.3142 18.2986 25.3971 17.9196V22.0802C24.6193 22.4123 23.8845 22.6465 23.1797 22.7871C22.4793 22.9276 21.6542 23 20.7131 23C18.7793 23 17.3826 22.5316 16.5318 21.5904C15.6766 20.6536 15.2512 19.2099 15.2512 17.2639V10.4503H13.2314V8.12944L15.7926 6.33661L17.2795 2.86169H21.0482V6.17477H25.1436V10.4503H21.0482V16.8849C21.0482 17.9537 21.5682 18.4903 22.6082 18.4903H22.6125Z" fill="white"/>
                          <path d="M37.6958 22.7105L36.5914 20.5216H36.4754C35.6976 21.4755 34.9112 22.127 34.1033 22.4763C33.2997 22.8255 32.2555 23 30.9791 23C29.4063 23 28.173 22.5316 27.2663 21.599C26.3638 20.6664 25.9126 19.3506 25.9126 17.6599C25.9126 15.9693 26.5314 14.5896 27.7691 13.7251C29.0067 12.8649 30.7987 12.3794 33.145 12.273L35.9297 12.1835V11.9493C35.9297 10.5866 35.2507 9.90524 33.897 9.90524C32.6809 9.90524 31.1338 10.3141 29.2559 11.1317L27.5929 7.36722C29.5353 6.37497 31.9933 5.87671 34.9585 5.87671C37.0985 5.87671 38.7573 6.40055 39.9305 7.45238C41.1036 8.50421 41.6923 9.9734 41.6923 11.8599V22.7019H37.7002L37.6958 22.7105ZM33.4243 18.9715C34.1205 18.9715 34.7178 18.7544 35.212 18.3157C35.7062 17.8771 35.9554 17.3107 35.9554 16.6081V15.322L34.6319 15.3817C32.7367 15.4498 31.7913 16.1396 31.7913 17.4555C31.7913 18.469 32.3371 18.9715 33.4243 18.9715Z" fill="white"/>
                          <path d="M55.8481 17.6301C55.8481 19.4017 55.2379 20.7388 54.0218 21.6416C52.8056 22.5444 51.0566 23 48.779 23C47.5414 23 46.4671 22.9361 45.5518 22.8041C44.6407 22.6721 43.7039 22.4337 42.7542 22.0802V17.5109C43.6481 17.8984 44.6278 18.222 45.6936 18.4733C46.7593 18.7246 47.709 18.8523 48.5427 18.8523C49.7889 18.8523 50.412 18.5712 50.412 18.0048C50.412 17.7153 50.2358 17.4513 49.8878 17.2256C49.5397 16.9956 48.5255 16.5527 46.8452 15.8884C45.3154 15.2666 44.2411 14.5598 43.6351 13.7634C43.0249 12.9714 42.7241 11.9663 42.7241 10.7484C42.7241 9.21108 43.3214 8.01447 44.5204 7.15853C45.7193 6.30259 47.4125 5.87244 49.5999 5.87244C50.6999 5.87244 51.7313 5.9917 52.6982 6.23017C53.6651 6.46864 54.6707 6.81785 55.7106 7.27347L54.1507 10.9528C53.3857 10.6121 52.5736 10.3225 51.7184 10.0841C50.8632 9.8456 50.1671 9.7264 49.6256 9.7264C48.6845 9.7264 48.2118 9.95634 48.2118 10.412C48.2118 10.6931 48.3751 10.9358 48.706 11.136C49.0326 11.3361 49.9823 11.7406 51.5551 12.3538C52.724 12.8308 53.5963 13.2993 54.1679 13.7549C54.7437 14.2106 55.1648 14.7514 55.4356 15.3689C55.7063 15.9863 55.8396 16.7401 55.8396 17.6216L55.8481 17.6301Z" fill="white"/>
                          <path d="M66.9009 22.7104V13.691C66.9009 11.4723 66.2389 10.3651 64.9108 10.3651C63.9701 10.3651 63.2734 10.7569 62.8269 11.5404C62.3799 12.324 62.1564 13.6228 62.1564 15.4455V22.7147H56.3979V0H62.1564V3.22366C62.1564 4.68432 62.079 6.34514 61.9198 8.21459H62.1865C62.7365 7.35865 63.3894 6.75392 64.1459 6.40471C64.9023 6.05556 65.7787 5.88093 66.7803 5.88093C68.6452 5.88093 70.0978 6.41324 71.1335 7.47786C72.1692 8.54248 72.6891 10.0329 72.6891 11.9493V22.7062H66.9009V22.7104Z" fill="white"/>
                          <path d="M82.5172 18.4903C83.2907 18.4903 84.2189 18.2986 85.3018 17.9196V22.0802C84.5283 22.4123 83.7889 22.6465 83.0842 22.7871C82.3841 22.9276 81.5588 23 80.6176 23C78.6838 23 77.2875 22.5316 76.4367 21.5904C75.5813 20.6536 75.1559 19.2099 75.1559 17.2639V10.4503H73.1362V8.12944L75.6973 6.33661L77.184 2.86169H80.9531V6.17477H85.0481V10.4503H80.9531V16.8849C80.9531 17.9537 81.473 18.4903 82.5126 18.4903H82.5172Z" fill="white"/>
                          <path d="M90.9999 21.7864C90.9999 22.4549 90.57 23 90.0416 23H87.807C87.2786 23 86.8486 22.4549 86.8486 21.7864V20.0319C86.8486 19.3633 87.2786 18.8182 87.807 18.8182H90.0416C90.57 18.8182 90.9999 19.3633 90.9999 20.0319V21.7864Z" fill="white"/>
                        </g>
                      </svg>
                    </div>
                  </div>

                  {/* Memory Cards - Scrolls over the header image */}
                  <div className="relative z-10 space-y-6 -mt-48 px-4 mx-2">
                    {/* Timeline Info Bar - Top of memory cards */}
                    <div className="flex items-center justify-between rounded-2xl">
                      <div className="text-gray-900 text-lg">
                        <span className="font-semibold text-white">Timeline</span>
                        <span className="mx-2 text-gray-400 text-white">•</span>
                        <span className="text-gray-500 text-white">{totalMomentsCount} moments</span>
                      </div>
                      <button className="px-4 py-2 bg-gray-100 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 transition-colors" onClick={() => { if (firstContentRef.current) firstContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                        Continue
                      </button>
                    </div>
                <div ref={firstContentRef} />
                {renderWidgets(topWidgetList, true)}
                {publishedTimelineItems.length > 0 ? (
                  publishedTimelineItems.map((item: any, combinedIndex: number) => {
                    if (item.type === 'linked') {
                      const lm = (memoryData?.linked_memories || []).find((l: any) => String(l.id) === item.id);
                      if (!lm) return null;
                      const lmDateRange = lm.min_uploaded_img_date
                        ? lm.min_uploaded_img_date === lm.max_uploaded_img_date
                          ? new Date(lm.min_uploaded_img_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : `${new Date(lm.min_uploaded_img_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(lm.max_uploaded_img_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : '';
                      return (
                        <div key={`lm-${lm.id}`} data-pub-lm-id={lm.id} className={`w-full rounded-2xl overflow-hidden transition-all duration-200 ${activePubLmId === String(lm.id) && isHeaderImageScrolled ? 'border-2 border-[#6C60FF]' : 'border border-gray-100'}`}>
                          <MemoryCard
                            image={lm.cover_image || lm.last_update_img || null}
                            title={lm.title || 'Untitled'}
                            dateRange={lmDateRange}
                            location={typeof lm.location === 'string' ? lm.location : (lm.location?.formatted || '')}
                            category={lm.category?.name || lm.category || ''}
                            photosCount={lm.posts_count || 0}
                            imagesCount={lm.posts_count || 0}
                            published={lm.published}
                            fullName={lm.user?.name || memoryData?.user?.name}
                            avatar={lm.user?.profile_image || memoryData?.user?.profile_image}
                            profileColor={lm.user?.profile_color || memoryData?.user?.profile_color}
                            tags={lm.is_car ? carLinkedMemoryTags(lm) : (Array.isArray(lm.tags) ? lm.tags : [])}
                            label={lm.is_car ? carLinkedMemoryLabel(lm) : (lm.sub_category?.name || '')}
                            contributors={Array.isArray(lm.collaborators) ? lm.collaborators.map((c: any) => ({ id: c.id || c.user_id, name: c.name || c.user?.name || '', avatar: c.profile_image || c.user?.profile_image || '', profileColor: c.profile_color || c.user?.profile_color || '' })) : []}
                            whiteFooter={true}
                            onClick={() => handleLinkedMemoryClick(lm)}
                          />
                        </div>
                      );
                    }
                    const postIndex = sortedPosts.findIndex((p: any) => String(p.id) === item.id);
                    if (postIndex === -1) return null;
                    const post = sortedPosts[postIndex];
                    const index = postIndex;
                    const docusignDoc = memoryData?.docusign_documents?.[post.id?.toString()];
                    const authorName = memoryData?.user?.name || 'Unknown';
                    const authorAvatar = memoryData?.user?.profile_image;
                    const initials = authorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                    return (
                      <React.Fragment key={post.id}>
                        <div
                          ref={(el) => { memoryCardRefs.current[index] = el; }}
                          data-index={index}
                          className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all duration-200 ${
                            activeMemoryIndex === index && isHeaderImageScrolled
                              ? 'border-2 border-[#6C60FF]'
                              : 'border border-gray-100'
                          }`}
                        >
                          <PublishedPostCard
                            post={post}
                            index={index}
                            memoryData={memoryData}
                            onImageClick={handleImageClick}
                            onCommentClick={handleCommentClick}
                          />
                        </div>
                        {docusignDoc && (
                          <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white hover:shadow-md transition-all duration-200">
                            <div className="aspect-[4/3] cursor-pointer overflow-hidden" onClick={() => handlePdfDocumentView(docusignDoc)}>
                              <PdfThumbnail url={docusignDoc.signed_document_url} className="w-full h-full" />
                            </div>
                            <div className="space-y-3 p-[22px] lg:p-6">
                              <div className="flex items-center gap-3">
                                <div className="h-[30px] w-[30px] rounded-full overflow-hidden bg-gradient-to-br from-[#6C60FF] to-purple-600 flex items-center justify-center flex-shrink-0">
                                  {authorAvatar ? <img src={authorAvatar} alt={authorName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <span className="text-white text-xs font-medium">{initials}</span>}
                                </div>
                                <p className="font-medium text-[#364153] text-lg md:text-base flex-1 truncate">{authorName}</p>
                                <div className="flex items-center gap-3 text-[15px] md:text-sm text-gray-600">
                                  <span className="flex items-center gap-1"><Heart className="h-5 w-5 md:h-4 md:w-4" />0</span>
                                  <span className="flex items-center gap-1"><MessageSquare className="h-5 w-5 md:h-4 md:w-4" />0</span>
                                  <span className="hidden md:flex items-center gap-1"><Share2 className="h-4 w-4" />0</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-[#6C60FF] flex-shrink-0" />
                                <p className="text-sm text-[#364153] truncate flex-1">{docusignDoc.document_name}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {renderWidgets(widgetsAfter(post.id), true)}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-gray-500 bg-white rounded-xl">
                    <p className="text-lg">No moments to display</p>
                  </div>
                )}
                  {/* Pinned-to-bottom widgets — render after the whole timeline */}
                  {renderWidgets(bottomWidgetList, true)}
                  {/* Footer inside parallax scrolling area */}
                  <div className="mt-8 py-6 text-center">
                    <p className="text-base text-gray-500">
                      Powered by <span className="font-semibold text-[#6C60FF]">Stasht</span>
                    </p>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Viewer Modal - Desktop: Image + Sidebar, Mobile: Image with Info Overlay */}
      {imageViewer.isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black flex flex-col md:flex-row">
          {/* Mobile View - Full Screen Image with Overlays */}
          <div className="md:hidden w-full h-full flex flex-col bg-black relative">
            {/* Mobile Top Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
              <button
                onClick={handleCloseImageViewer}
                className="w-10 h-10 flex items-center justify-center text-white mb-3"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="text-left px-4" style={{marginTop: "-50px", marginLeft: "30px"}}>
                <h2 className="text-lg font-semibold text-white mb-1">
                  {((imageViewer.imageAlt || memoryData.title) || '').length > 12 ? (imageViewer.imageAlt || memoryData.title).substring(0, 12) + '...' : (imageViewer.imageAlt || memoryData.title)}
                </h2>
                <p className="text-sm text-gray-300">
                  {imageViewer.user_name}
                  {imageViewer.location && ` • ${imageViewer.location}`}
                </p>
              </div>
            </div>

            {/* Mobile Image / PDF Container */}
            <div className="flex-1 flex items-center justify-center">
              {imageViewer.isPdf ? (
                pdfBlobUrl
                  ? <iframe src={pdfBlobUrl} className="w-4/5 h-full border-0 rounded-lg" title={imageViewer.title || 'PDF'} style={{ minHeight: '60vh' }} />
                  : <div className="flex flex-col items-center gap-3 text-white/60"><svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><span className="text-sm">Loading PDF…</span></div>
              ) : (
                <ImageWithFallback
                  src={currentDisplayImage.src}
                  alt={currentDisplayImage.alt}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Mobile Sub-images Thumbnails */}
            {hasSubImages && (
              <div className="absolute top-24 left-0 right-0 z-10 px-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  <button
                    onClick={() => setCurrentSubImageIndex(0)}
                    className={`relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${currentSubImageIndex === 0 ? 'border-[#6C60FF]' : 'border-white/30'}`}
                  >
                    <ImageWithFallback src={imageViewer.imageSrc} alt="Main" className="w-full h-full object-cover" />
                  </button>
                  {viewerSubImages.map((subImg: any, idx: number) => (
                    <button
                      key={subImg.id || idx}
                      onClick={() => setCurrentSubImageIndex(idx + 1)}
                      className={`relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${currentSubImageIndex === idx + 1 ? 'border-[#6C60FF]' : 'border-white/30'}`}
                    >
                      <ImageWithFallback src={subImg.image_link || subImg.master_image_link} alt={`Sub ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  <div className="flex-shrink-0 text-white text-xs font-medium px-2">
                    {currentSubImageIndex + 1}/{totalSubImages + 1}
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Bottom Info Section */}
            <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black via-black/90 to-transparent p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden bg-gradient-to-br from-[#6C60FF] to-purple-600 text-white flex-shrink-0">
                  {imageViewer.user_profile ? (
                    <img
                      src={imageViewer.user_profile}
                      alt={imageViewer.user_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    imageViewer.user_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium text-sm mb-1">
                    {imageViewer.user_name}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-300 mb-2">
                    {imageViewer.uploaded_at && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {new Date(imageViewer.uploaded_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                    {imageViewer.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{imageViewer.location}</span>
                      </div>
                    )}
                  </div>
                  {imageViewer.description && (
                    <p className="text-sm text-gray-200 leading-relaxed line-clamp-3">
                      {imageViewer.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Comments Icon Button */}
              <button
                onClick={() => setShowMobileComments(true)}
                className="absolute bottom-2 right-4 flex flex-col items-center justify-center rounded-lg min-w-[48px] p-2"
              >
                <CommentIcon className="w-5 h-5 text-white mb-1" />
                <span className="text-xs text-white font-medium">
                  {imageViewer.comments_count || 0}
                </span>
              </button>
            </div>
          </div>

          {/* Left Side - Image Area (Desktop) */}
          <div className="hidden md:flex flex-1 flex-col relative">
            {/* Header - Desktop */}
            <div className="flex items-center justify-between text-white bg-black/50 p-6">
              <div className="flex items-center gap-3">
                {/* Checkbox and Image Name */}
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border border-white/60 rounded"></div>
                  <div>
                    {/* Filename/Title */}
                    {(imageViewer.title || imageViewer.imageAlt || memoryData.title) && (
                      <h2 className="text-lg font-medium">
                        {imageViewer.title || imageViewer.imageAlt || memoryData.title}
                      </h2>
                    )}

                    {/* Date and Location */}
                    <div className="flex items-center gap-4 text-sm text-white/80">
                      {imageViewer.uploaded_at && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(imageViewer.uploaded_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}</span>
                        </div>
                      )}
                      {imageViewer.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{imageViewer.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Image counter */}
                    {sortedPosts.length > 1 && (
                      <p className="text-xs text-white/60 mt-1">
                        {imageViewer.currentIndex + 1} of {sortedPosts.length}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Toolbar Buttons */}
              <div className="flex items-center gap-2">
                {/* Zoom Controls */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
                </Button>

                <span className="text-white text-sm min-w-[4rem] text-center">100%</span>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                </Button>

                {/* Rotate */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  title="Rotate image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </Button>

                {/* Download */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  title="Download image"
                >
                  <Download className="w-4 h-4" />
                </Button>

                {/* Close */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseImageViewer}
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Main Content Area with Sub-images Sidebar and Image Container */}
            <div className="flex-1 flex flex-row overflow-hidden">
              {/* Sidebar - Sub-images Thumbnails (Left on Desktop) — hidden for PDFs */}
              <div className={`flex flex-col w-[180px] border-r border-gray-800 bg-black p-4 gap-3 overflow-y-auto ${imageViewer.isPdf ? 'hidden' : ''}`}>
                {/* Image Counter */}
                <div className="flex items-center justify-center text-center py-2">
                  <span className="text-sm text-white font-medium">
                    Image {currentSubImageIndex + 1} of {totalSubImages + 1}
                  </span>
                </div>

                {/* Current/Main Image Thumbnail */}
                <div
                  className={`group relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all w-full aspect-square flex-shrink-0 ${
                    currentSubImageIndex === 0 ? 'border-[#6C60FF] shadow-lg shadow-[#6C60FF]/30' : 'border-gray-700 hover:border-gray-500'
                  }`}
                  onClick={() => setCurrentSubImageIndex(0)}
                >
                  <ImageWithFallback
                    src={imageViewer.imageSrc}
                    alt="Main"
                    className="w-full h-full object-cover"
                  />
                  {currentSubImageIndex === 0 && (
                    <div className="absolute inset-0 bg-[#6C60FF]/20"></div>
                  )}
                </div>

                {/* Sub-images Thumbnails */}
                {viewerSubImages.map((subImg: any, idx: number) => (
                  <div
                    key={subImg.id || idx}
                    className={`group relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all w-full aspect-square flex-shrink-0 ${
                      currentSubImageIndex === idx + 1 ? 'border-[#6C60FF] shadow-lg shadow-[#6C60FF]/30' : 'border-gray-700 hover:border-gray-500'
                    }`}
                    onClick={() => setCurrentSubImageIndex(idx + 1)}
                  >
                    <ImageWithFallback
                      src={subImg.image_link || subImg.master_image_link}
                      alt={`Sub ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {currentSubImageIndex === idx + 1 && (
                      <div className="absolute inset-0 bg-[#6C60FF]/20"></div>
                    )}
                  </div>
                ))}
              </div>

              {/* Image Container */}
              <div
                className="flex-1 flex items-center justify-center relative overflow-hidden cursor-grab active:cursor-grabbing p-8"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    handleCloseImageViewer();
                  }
                }}
              >
                {/* Image / PDF */}
                {imageViewer.isPdf ? (
                  pdfBlobUrl
                    ? <iframe src={pdfBlobUrl} className="border-0 rounded-lg" title={imageViewer.title || 'PDF'} style={{ width: '75%', height: '75vh', minHeight: '500px' }} />
                    : <div className="flex flex-col items-center gap-3 text-white/60"><svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><span className="text-sm">Loading PDF…</span></div>
                ) : (
                  <div
                    className="relative transition-transform duration-200 ease-out"
                    style={{ maxWidth: '100%' }}
                  >
                    <ImageWithFallback
                      src={currentDisplayImage.src}
                      alt={currentDisplayImage.alt}
                      className="w-full h-full object-contain max-h-[calc(100vh-200px)]"
                    />
                  </div>
                )}

                {/* Carousel Navigation */}
                {sortedPosts.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={handlePrevImage}
                      disabled={imageViewer.currentIndex === 0}
                      className="flex absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 disabled:hover:bg-black/50 transition-all duration-200"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={handleNextImage}
                      disabled={imageViewer.currentIndex === sortedPosts.length - 1}
                      className="flex absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 disabled:hover:bg-black/50 transition-all duration-200"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Footer/Help - Desktop only */}
            <div className="p-4 bg-black/50">
              <div className="text-center text-white/60 text-sm">
                <p>
                  <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">Esc</kbd> to close •
                  <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">+/-</kbd> to zoom •
                  <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">R</kbd> to rotate •
                  <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">0</kbd> to reset
                  {sortedPosts.length > 1 && (
                    <> • <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">←/→</kbd> navigate</>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Details and Comments (Desktop) */}
          <div className="hidden md:flex md:w-96 bg-black text-white flex-col h-full border-l border-gray-800">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-base font-semibold">Details</h3>
              <button
                onClick={handleCloseImageViewer}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Info & Description */}
            <div className="p-4 border-b border-gray-800">
              {/* User Info */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden bg-blue-600 text-white flex-shrink-0">
                  {imageViewer.user_profile ? (
                    <img
                      src={imageViewer.user_profile}
                      alt={imageViewer.user_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    imageViewer.user_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'
                  )}
                </div>
                <span className="font-medium">{imageViewer.user_name || 'Unknown'}</span>
              </div>

              {/* Description Text */}
              <p className="text-gray-300 text-sm leading-relaxed">
                {imageViewer.description || imageViewer.title || 'No description'}
              </p>
            </div>

            {/* Comments Section */}
            <div className="flex-1 overflow-y-auto">
              {/* Comments Header */}
              <div className="flex items-center gap-2 p-4 border-b border-gray-800">
                <MessageSquare className="w-5 h-5" />
                <span className="font-semibold">
                  Comments ({imageViewer.comments?.length || 0})
                </span>
              </div>

              {/* Comments List */}
              <div className="p-4">
                {imageViewer.comments && imageViewer.comments.length > 0 ? (
                  <div className="space-y-4">
                    {imageViewer.comments.map((comment: any) => (
                      <div key={comment.id} className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium overflow-hidden bg-blue-600 text-white flex-shrink-0">
                            {comment.user?.profile_image ? (
                              <img
                                src={comment.user.profile_image}
                                alt={comment.user.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              comment.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-white">{comment.user?.name || 'Anonymous'}</span>
                              {comment.created_at && (
                                <span className="text-xs text-gray-500">
                                  {new Date(comment.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-300">{comment.description || comment.comment}</p>
                          </div>
                        </div>

                        {/* Nested Replies */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="ml-11 space-y-3 border-l-2 border-gray-700 pl-4">
                            {comment.replies.map((reply: any) => (
                              <div key={reply.id} className="flex items-start gap-3">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium overflow-hidden bg-blue-600 text-white flex-shrink-0">
                                  {reply.user?.profile_image ? (
                                    <img
                                      src={reply.user.profile_image}
                                      alt={reply.user.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    reply.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-xs font-medium text-white">{reply.user?.name || 'Anonymous'}</span>
                                    {reply.created_at && (
                                      <span className="text-xs text-gray-500">
                                        {new Date(reply.created_at).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric'
                                        })}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-300">{reply.description || reply.comment}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">No comments yet</p>
                  </div>
                )}

                {/* Login prompt for non-authenticated users - Below comments */}
                {!isAuthenticated && (
                  <div className="mt-6 pt-4 border-t border-gray-800">
                    <p className="text-sm text-gray-300 text-center mb-4">
                      Login or signup to join the conversation
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button
                        onClick={() => {
                          const redirectData = {
                            url: window.location.pathname,
                            imageIndex: imageViewer.currentIndex,
                            slug: slug,
                            timestamp: Date.now()
                          };
                          sessionStorage.setItem('redirectAfterLogin', JSON.stringify(redirectData));
                          localStorage.setItem('pendingRedirectAfterLogin', JSON.stringify(redirectData));
                          navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}&imageIndex=${imageViewer.currentIndex}`);
                        }}
                        className="bg-[#6C60FF] hover:bg-[#5850E5] text-white px-6"
                      >
                        Login
                      </Button>
                      <Button
                        onClick={() => {
                          const redirectData = {
                            url: window.location.pathname,
                            imageIndex: imageViewer.currentIndex,
                            slug: slug,
                            timestamp: Date.now()
                          };
                          sessionStorage.setItem('redirectAfterLogin', JSON.stringify(redirectData));
                          localStorage.setItem('pendingRedirectAfterLogin', JSON.stringify(redirectData));
                          navigate(`/signup?redirect=${encodeURIComponent(window.location.pathname)}&imageIndex=${imageViewer.currentIndex}`);
                        }}
                        variant="outline"
                        className="border-[#6C60FF] text-[#6C60FF] hover:bg-[#6C60FF] hover:text-white px-6"
                      >
                        Sign Up
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Comment Input for authenticated users */}
            {isAuthenticated && (
              <div className="p-4 border-t border-gray-800">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium overflow-hidden bg-blue-600 text-white flex-shrink-0">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="flex-1">
                    <textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-[#6C60FF]"
                      rows={2}
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={handleSubmitComment}
                        disabled={!newComment.trim()}
                        className="flex items-center gap-2 bg-[#6C60FF] hover:bg-[#5850E5] disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer with keyboard shortcuts */}
            <div className="p-4 border-t border-gray-800 text-center">
              <p className="text-xs text-gray-500">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">Esc</kbd> to close
                {sortedPosts.length > 1 && (
                  <> • <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">←/→</kbd> navigate</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Comments Bottom Sheet */}
      {showMobileComments && imageViewer.isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-[100000]"
            onClick={() => setShowMobileComments(false)}
          />

          {/* Bottom Sheet */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white z-[100001] rounded-t-3xl max-h-[75vh] flex flex-col">
            {/* Drag Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                Comments ({imageViewer.comments?.length || 0})
              </h3>
              <button
                onClick={() => setShowMobileComments(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* User Info and Description */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden bg-gradient-to-br from-[#6C60FF] to-purple-600 text-white flex-shrink-0">
                  {imageViewer.user_profile ? (
                    <img
                      src={imageViewer.user_profile}
                      alt={imageViewer.user_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    imageViewer.user_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{imageViewer.user_name}</span>
                    <span className="text-xs text-gray-500">1w ago</span>
                  </div>
                  {imageViewer.description && (
                    <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                      {imageViewer.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4">
              {!imageViewer.comments || imageViewer.comments.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No comments yet. Be the first to comment!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {imageViewer.comments.map((comment: any) => (
                    <div key={comment.id} className="space-y-3">
                      <div className="flex gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden bg-gradient-to-br from-blue-500 to-purple-500 text-white flex-shrink-0">
                          {comment.user?.profile_image ? (
                            <img
                              src={comment.user.profile_image}
                              alt={comment.user.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            comment.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-gray-900">{comment.user?.name || 'Anonymous'}</span>
                            {comment.created_at && (
                              <span className="text-xs text-gray-500">
                                {new Date(comment.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-800 leading-relaxed">
                            {comment.description || comment.comment}
                          </p>
                        </div>
                      </div>

                      {/* Nested Replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="ml-12 space-y-3">
                          {comment.replies.map((reply: any) => (
                            <div key={reply.id} className="flex gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden bg-gradient-to-br from-green-500 to-blue-500 text-white flex-shrink-0">
                                {reply.user?.profile_image ? (
                                  <img
                                    src={reply.user.profile_image}
                                    alt={reply.user.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  reply.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-sm text-gray-900">{reply.user?.name || 'Anonymous'}</span>
                                  {reply.created_at && (
                                    <span className="text-xs text-gray-500">
                                      {new Date(reply.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                      })}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-800 leading-relaxed">
                                  {reply.description || reply.comment}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input Section */}
            {isAuthenticated ? (
              <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4">
                <div className="flex gap-2 items-center">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden bg-gradient-to-br from-[#6C60FF] to-purple-600 text-white flex-shrink-0">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-full px-4 py-3 border border-gray-200">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-1 bg-transparent text-base text-gray-900 placeholder-gray-400 focus:outline-none"
                    />
                    <button
                      onClick={handleSubmitComment}
                      disabled={!newComment.trim()}
                      className="p-2.5 rounded-full bg-[#6C60FF] disabled:bg-gray-300 text-white"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4">
                <div className="text-center py-2 px-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-3">
                    Login or signup to join the conversation
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={() => {
                        const redirectData = {
                          url: window.location.pathname,
                          imageIndex: imageViewer.currentIndex,
                          openComments: true,
                          slug: slug,
                          timestamp: Date.now()
                        };
                        sessionStorage.setItem('redirectAfterLogin', JSON.stringify(redirectData));
                        localStorage.setItem('pendingRedirectAfterLogin', JSON.stringify(redirectData));
                        navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
                      }}
                      className="bg-[#6C60FF] hover:bg-[#5850E5] text-white px-6"
                      size="sm"
                    >
                      Login
                    </Button>
                    <Button
                      onClick={() => {
                        const redirectData = {
                          url: window.location.pathname,
                          imageIndex: imageViewer.currentIndex,
                          openComments: true,
                          slug: slug,
                          timestamp: Date.now()
                        };
                        sessionStorage.setItem('redirectAfterLogin', JSON.stringify(redirectData));
                        localStorage.setItem('pendingRedirectAfterLogin', JSON.stringify(redirectData));
                        navigate(`/signup?redirect=${encodeURIComponent(window.location.pathname)}`);
                      }}
                      variant="outline"
                      className="border-[#6C60FF] text-[#6C60FF] hover:bg-[#6C60FF] hover:text-white px-6"
                      size="sm"
                    >
                      Sign Up
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Request a Moment submission modal ─────────────────────────────── */}
      <RequestMomentModal
        open={showRequestMomentModal}
        onOpenChange={setShowRequestMomentModal}
        memoryId={memoryData?.id}
        afterPostId={requestMomentAfterPostId}
        variant="public"
      />

      {/* ── Car photo viewer: opens directly from the campaign (filmstrip + spec sheet, no comments) ── */}
      {selectedCarDetail && (
        <CarPhotoViewer
          car={selectedCarDetail}
          photoIndex={carPhotoIndex}
          onPhotoIndexChange={setCarPhotoIndex}
          onClose={() => setSelectedCarDetail(null)}
          imageLarge={carImageLarge}
          linkedLabel={carLinkedMemoryLabel}
        />
      )}
    </>
  );
}
