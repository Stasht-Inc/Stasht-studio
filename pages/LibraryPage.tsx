import { useState, useEffect, useRef } from 'react';
import {
  Search, Loader2, AlertCircle, ArrowLeft,
  Plus, QrCode, Pencil, X, Calendar, Folder, Trash2, Camera, Edit, Crop, ImageIcon, Sparkles, Zap, RotateCcw, RotateCw
} from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogPortal, DialogOverlay } from '../components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { dashboardAPI, getApiBaseUrl } from '../utils/authUtils';
import { aiCreditsAPI, type CreditCheckResponse } from '../services/aiCreditsAPI';
import { mediaAPI } from '../services/mediaAPI';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface RawPhoto {
  id?: number | string;
  photo_id?: number | string;
  face_photo_id?: number | string;
  media_id?: number | string;
  url?: string;
  photo_url?: string;
  image_url?: string;
  file_url?: string;
  path?: string;
  thumbnail?: string;
  filename?: string;
  file_name?: string;
  original_name?: string;
  file_size?: number | string;
  size?: number | string;
  width?: number;
  height?: number;
  dimensions?: string;
  created_at?: string;
  date?: string;
  taken_at?: string;
  bounding_box?: BBox;
}

interface RawMemory {
  memory_id: number;
  memory_title: string;
  memory_date: string;
  photo_count: number;
  photos: RawPhoto[];
}

interface RawFace {
  face_id?: string;
  cluster_id?: string;
  person_id?: string | number;
  name?: string;
  thumbnail?: string;
  representative_photo: string;
  representative_bbox?: BBox;
  total_photos: number;
  memory_count: number;
  max_confidence: number;
  memories: RawMemory[];
}

function getRawFaceId(face: RawFace): string {
  return face.face_id ?? face.cluster_id ?? '';
}

interface PersonCard {
  id: string;
  rawIndex: number;
  number: number;
  name: string;
  photoCount: number;
  memoryCount: number;
  coverPhotos: string[];
  tags: string[];
  bbox: BBox | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPhotoId(photo: RawPhoto): number | string | undefined {
  return photo.id ?? photo.face_photo_id ?? photo.photo_id ?? photo.media_id;
}

function getPhotoUrl(photo: RawPhoto): string {
  return (
    photo.url ?? photo.photo_url ?? photo.image_url ??
    photo.file_url ?? photo.path ?? photo.thumbnail ?? ''
  );
}

function getPhotoFilename(photo: RawPhoto): string {
  return photo.filename ?? photo.file_name ?? photo.original_name ?? '';
}

function getPhotoSize(photo: RawPhoto): string {
  const s = photo.file_size ?? photo.size;
  if (!s) return '';
  const bytes = typeof s === 'string' ? parseFloat(s) : s;
  if (isNaN(bytes)) return String(s);
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function getPhotoDimensions(photo: RawPhoto): string {
  if (photo.dimensions) return photo.dimensions;
  if (photo.width && photo.height) return `${photo.width}×${photo.height}`;
  return '';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeFace(raw: RawFace, index: number): PersonCard {
  // Use thumbnail if available, otherwise fall back to representative_photo
  const rep = (raw.thumbnail || raw.representative_photo) ?? '';
  const repFallback = raw.representative_photo ?? '';
  let second = '';
  const firstMem = raw.memories?.[0];
  if (firstMem?.photos?.length > 0) {
    const url = getPhotoUrl(firstMem.photos[0]);
    if (url && url !== rep && url !== repFallback) second = url;
  }

  // thumbnail is already a pre-cropped face image — no bbox needed
  // Only apply bbox when showing representative_photo (full photo)
  const bbox: BBox | null = raw.thumbnail
    ? null
    : (raw.representative_bbox ?? raw.memories?.[0]?.photos?.[0]?.bounding_box ?? null);

  return {
    id: getRawFaceId(raw) || String(index),
    rawIndex: index,
    number: index + 1,
    name: raw.name ?? '',
    photoCount: raw.total_photos ?? 0,
    memoryCount: raw.memory_count ?? 0,
    coverPhotos: [rep, second].filter(Boolean),
    tags: (raw.memories ?? []).slice(0, 3).map(m => m.memory_title ?? 'Campaign'),
    bbox,
  };
}

// ─── Face Crop (responsive) ───────────────────────────────────────────────────

function FaceCropFill({ src, bbox, onError }: { src: string; bbox: BBox | null; onError?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasValidBbox = bbox && bbox.width && bbox.height && size > 0;

  let imgStyle: React.CSSProperties = {
    position: 'absolute', top: 0, left: 0,
    width: '100%', height: '100%',
    objectFit: 'cover',
  };

  if (hasValidBbox) {
    const { left, top, width, height } = bbox;
    const PADDING = 0.25;
    const cx = left + width / 2;
    const cy = top + height / 2;
    const S = 1 / (Math.max(width, height) * (1 + 2 * PADDING));
    const translateX = size * (0.5 - cx * S);
    const translateY = size * (0.5 - cy * S);
    imgStyle = {
      position: 'absolute',
      width: size,
      height: size,
      objectFit: 'cover',
      transformOrigin: '0 0',
      transform: `translate(${translateX}px, ${translateY}px) scale(${S})`,
    };
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <img src={src} alt="" style={imgStyle} onError={onError} />
    </div>
  );
}

// ─── Library Card ─────────────────────────────────────────────────────────────

function PersonCardItem({
  person,
  onClick,
  selected,
  onToggleSelect,
}: {
  person: PersonCard;
  onClick: () => void;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const [imgError, setImgError] = useState<Record<number, boolean>>({});

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer relative group ${
        selected ? 'border-[#6C60FF] ring-2 ring-[#6C60FF]/30' : 'border-gray-200'
      }`}
    >
      {/* Checkbox — top-left, always visible */}
      <div
        className="absolute top-2 left-2 z-10"
        onClick={e => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          className="w-8 h-8 rounded-xl border-2 border-gray-300 bg-white data-[state=checked]:bg-[#6C60FF] data-[state=checked]:border-[#6C60FF] data-[state=checked]:text-white shadow-sm [&_svg]:w-5 [&_svg]:h-5"
        />
      </div>

      <div className="relative aspect-square overflow-hidden bg-gray-100">
        {person.coverPhotos.length > 0 && !imgError[0] ? (
          <FaceCropFill
            src={person.coverPhotos[0]}
            bbox={person.bbox}
            onError={() => setImgError(p => ({ ...p, 0: true }))}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-xs">No photo</span>
          </div>
        )}
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded-md">
          {person.photoCount} moments
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-gray-900 text-sm truncate">{person.name || `Person ${person.number}`}</p>
          {person.memoryCount > 0 && (
            <span className="text-xs text-gray-400 shrink-0">
              {person.memoryCount} {person.memoryCount === 1 ? 'campaign' : 'campaigns'}
            </span>
          )}
        </div>
        {person.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {person.tags.map((tag, i) => (
              <span key={i} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[8rem]">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Photo Campaign Card ─────────────────────────────────────────────────────────

function PhotoStoryCard({
  photo,
  memoryTitle,
  memoryDate,
  selected,
  onToggle,
}: {
  photo: RawPhoto;
  memoryTitle: string;
  memoryDate: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const url = getPhotoUrl(photo);
  const filename = getPhotoFilename(photo);
  const size = getPhotoSize(photo);
  const dims = getPhotoDimensions(photo);
  const date = formatDate(photo.created_at ?? photo.date ?? photo.taken_at ?? memoryDate);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {url && !imgError ? (
          <img src={url} alt="" className="w-full h-full object-cover"
            onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-xs">No image</span>
          </div>
        )}
        {/* Checkbox */}
        <div className="absolute top-2 left-2">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            className="w-8 h-8 rounded-xl border-2 border-gray-300 bg-white data-[state=checked]:bg-[#6C60FF] data-[state=checked]:border-[#6C60FF] data-[state=checked]:text-white shadow-sm [&_svg]:w-5 [&_svg]:h-5"
          />
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1.5">
        {/* Memory badge */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium truncate ${
          memoryTitle ? 'bg-[#6C60FF] text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          <Folder className="w-3 h-3 shrink-0" />
          <span className="truncate">{memoryTitle || 'Unassigned'}</span>
        </div>

        {/* Date */}
        {date && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>{date}</span>
          </div>
        )}

        {/* Filename */}
        {filename && (
          <p className="text-xs text-gray-700 truncate font-medium">{filename}</p>
        )}

        {/* Size + dimensions */}
        {(size || dims) && (
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{size}</span>
            <span>{dims}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Crop Helper ──────────────────────────────────────────────────────────────

function loadImageEl(url: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const S3_HOST = 'stasht-data.s3.us-east-2.amazonaws.com';
const LIVE_ORIGIN = 'https://studio.stasht.com';

function toProxiedUrl(imageSrc: string): string {
  try {
    const url = new URL(imageSrc);
    // Direct S3 URL → convert to relative proxy path
    if (url.hostname === S3_HOST) {
      return `/s3-proxy${url.pathname}${url.search}`;
    }
    // Already a proxied URL on any known origin (studio.stasht.com or current window origin)
    const knownOrigins = [LIVE_ORIGIN, window.location.origin];
    if (knownOrigins.includes(url.origin) && url.pathname.startsWith('/s3-proxy')) {
      return `${url.pathname}${url.search}`;
    }
  } catch { /* not a valid URL */ }
  return imageSrc;
}

// Convert any proxied URL back to a direct S3 URL (fallback when proxy fails)
function toDirectS3Url(imageSrc: string): string {
  try {
    if (imageSrc.startsWith('/s3-proxy/')) {
      return `https://${S3_HOST}${imageSrc.slice('/s3-proxy'.length)}`;
    }
    const url = new URL(imageSrc);
    const knownOrigins = [LIVE_ORIGIN, window.location.origin];
    if (knownOrigins.includes(url.origin) && url.pathname.startsWith('/s3-proxy/')) {
      return `https://${S3_HOST}${url.pathname.slice('/s3-proxy'.length)}${url.search}`;
    }
  } catch { /* not a valid URL */ }
  return imageSrc;
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area, rotation = 0): Promise<{ dataUrl: string; blob: Blob }> {
  let objectUrl: string | null = null;

  const isLocal = imageSrc.startsWith('blob:') || imageSrc.startsWith('data:');

  // Build an absolute fetch URL — use original if already absolute on current origin,
  // otherwise convert to a proxied relative path then make it absolute
  const proxied = isLocal ? imageSrc : toProxiedUrl(imageSrc);
  // If toProxiedUrl returned a relative path (/s3-proxy/...), make it absolute so fetch is unambiguous
  const fetchSrc = proxied.startsWith('/') ? `${window.location.origin}${proxied}` : proxied;

  const isImage = (resp: Response) => {
    const ct = resp.headers.get('content-type') || '';
    // Reject only explicit HTML responses (catch-all redirect returning index.html)
    return !ct.includes('text/html');
  };

  if (!isLocal) {
    // Try without auth first
    try {
      const resp = await fetch(fetchSrc);
      if (resp.ok && isImage(resp)) objectUrl = URL.createObjectURL(await resp.blob());
    } catch { /* fall through */ }

    // Retry with auth token
    if (!objectUrl) {
      const token = localStorage.getItem('stasht_token');
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      try {
        const resp = await fetch(fetchSrc, { headers, credentials: 'include' });
        if (resp.ok && isImage(resp)) objectUrl = URL.createObjectURL(await resp.blob());
      } catch { /* fall through to direct load */ }
    }

    // Last resort: try fetching the original URL directly (handles cases where proxy isn't configured)
    if (!objectUrl && fetchSrc !== imageSrc) {
      try {
        const resp = await fetch(imageSrc);
        if (resp.ok && isImage(resp)) objectUrl = URL.createObjectURL(await resp.blob());
      } catch { /* fall through */ }
    }
  }

  // If all fetches failed, fall back to direct S3 URL with crossOrigin=anonymous
  const fallbackSrc = isLocal ? imageSrc : toDirectS3Url(imageSrc);
  const imageEl = await loadImageEl(objectUrl ?? fallbackSrc, !objectUrl);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  if (rotation !== 0) {
    // Build a rotated intermediate canvas so pixelCrop coords stay correct
    const maxSize = Math.max(imageEl.naturalWidth, imageEl.naturalHeight);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;
    canvas.height = safeArea;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, safeArea, safeArea);
    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-imageEl.naturalWidth / 2, -imageEl.naturalHeight / 2);
    ctx.drawImage(imageEl, 0, 0);

    const rotatedData = ctx.getImageData(0, 0, safeArea, safeArea);
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pixelCrop.width, pixelCrop.height);
    ctx.putImageData(
      rotatedData,
      Math.round(0 - safeArea / 2 + imageEl.naturalWidth * 0.5 - pixelCrop.x),
      Math.round(0 - safeArea / 2 + imageEl.naturalHeight * 0.5 - pixelCrop.y)
    );
  } else {
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pixelCrop.width, pixelCrop.height);
    ctx.drawImage(imageEl, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  }

  if (objectUrl) URL.revokeObjectURL(objectUrl);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const resultBlob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Blob failed')), 'image/jpeg', 0.9)
  );
  return { dataUrl, blob: resultBlob };
}

// ─── Person Details View ──────────────────────────────────────────────────────

function PersonDetailView({
  face,
  personNumber,
  onBack,
  onFaceDeleted,
  onNavigate,
  onAIScanProgress,
  onScanComplete,
  onPersonAdded,
}: {
  face: RawFace;
  personNumber: number;
  onBack: () => void;
  onFaceDeleted: () => void;
  onNavigate?: (page: string) => void;
  onAIScanProgress?: (progress: number, status?: 'processing' | 'completed' | 'failed', personId?: string) => void;
  onScanComplete?: () => void;
  onPersonAdded?: () => void;
}) {
  // ── Local display state (updated optimistically on save) ──
  const [localName, setLocalName] = useState(face.name || `Person ${personNumber}`);
  const [localTags, setLocalTags] = useState<string[]>(
    (face.memories ?? []).map(m => m.memory_title ?? 'Campaign')
  );
  const [localThumbnail, setLocalThumbnail] = useState<string>('');

  // ── Edit mode state ──
  const [isEditingPersonCard, setIsEditingPersonCard] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editThumbnailPreview, setEditThumbnailPreview] = useState('');
  const [editThumbnailFile, setEditThumbnailFile] = useState<File | null>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const avatarThumbInputRef = useRef<HTMLInputElement>(null);

  // ── Image menu + crop state ──
  const [showImageMenu, setShowImageMenu] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropPosition, setCropPosition] = useState<Point>({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropApplying, setIsCropApplying] = useState(false);
  const [cropRotation, setCropRotation] = useState(0);
  const imageMenuRef = useRef<HTMLDivElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // ── Add Person to Library state ──
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [addPersonPhotos, setAddPersonPhotos] = useState<File[]>([]);
  const [addPersonPhotoUrls, setAddPersonPhotoUrls] = useState<{url: string; mediaId: string}[]>([]);
  const [addPersonPhotoPreviews, setAddPersonPhotoPreviews] = useState<string[]>([]);
  const [addPersonName, setAddPersonName] = useState('');
  const [addPersonTagInput, setAddPersonTagInput] = useState('');
  const [addPersonTags, setAddPersonTags] = useState<string[]>([]);
  const [showPhotoSourceMenu, setShowPhotoSourceMenu] = useState(false);
  const [isAddPersonMediaPickerOpen, setIsAddPersonMediaPickerOpen] = useState(false);
  const [addPersonMediaPickerSelected, setAddPersonMediaPickerSelected] = useState<Set<string>>(new Set());
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const addPersonFileInputRef = useRef<HTMLInputElement>(null);
  const photoSourceMenuRef = useRef<HTMLDivElement>(null);

  // ── Media picker state ──
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaPickerImages, setMediaPickerImages] = useState<{ id: string; image: string; title: string; tags: string[] }[]>([]);
  const [isLoadingMediaPicker, setIsLoadingMediaPicker] = useState(false);
  const [mediaPickerSearch, setMediaPickerSearch] = useState('');

  // ── Scan state ──
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isAIScanModalOpen, setIsAIScanModalOpen] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('');
  const [scanComplete, setScanComplete] = useState(false);
  const [scanNewMatches, setScanNewMatches] = useState(0);

  // Auto-minimize: close modal after 40 seconds, sidebar takes over
  useEffect(() => {
    if (!isAIScanModalOpen || !isScanning) return;
    const timer = setTimeout(() => {
      setIsAIScanModalOpen(false);
    }, 40000);
    return () => clearTimeout(timer);
  }, [isAIScanModalOpen, isScanning]);

  // Sync progress to sidebar whenever scanProgress changes while modal is closed but scan is running
  useEffect(() => {
    if (!isAIScanModalOpen && isScanning) {
      onAIScanProgress?.(scanProgress, 'processing');
    }
  }, [scanProgress, isAIScanModalOpen, isScanning]);

  // ── Credits confirmation modal state ──
  const [isCreditsModalOpen, setIsCreditsModalOpen] = useState(false);
  const [isCheckingCredits, setIsCheckingCredits] = useState(false);
  const [creditsCheck, setCreditsCheck] = useState<CreditCheckResponse | null>(null);
  const [isAddCreditsModalOpen, setIsAddCreditsModalOpen] = useState(false);

  const handleAIScanClick = async () => {
    setIsCheckingCredits(true);
    setIsCreditsModalOpen(true);
    setCreditsCheck(null);
    try {
      const result = await aiCreditsAPI.checkSufficientCredits('ai_memory_wizard', 2);
      setCreditsCheck(result);
      if (!result.has_sufficient_credits) {
        setIsCreditsModalOpen(false);
        setIsAddCreditsModalOpen(true);
      }
    } catch (err) {
      toast.error('Failed to check credits. Please try again.');
      setIsCreditsModalOpen(false);
    } finally {
      setIsCheckingCredits(false);
    }
  };

  const handleScanFace = async () => {
    setIsCreditsModalOpen(false);
    const personId = face.person_id ? String(face.person_id) : '';
    if (!personId) {
      toast.error('No person ID found for this face.');
      return;
    }

    setIsScanning(true);
    setScanProgress(0);
    setScanComplete(false);
    setScanNewMatches(0);
    setScanStatusText('Preparing to scan...');
    setIsAIScanModalOpen(true);

    const LIMIT = 50;
    let offset = 0;
    let totalNewMatches = 0;
    let totalScanned = 0;
    let hasMore = true;
    let totalImages = 0;

    // +1% every 10 seconds — slow steady movement from 0 to 95
    let displayProgress = 0;
    const animInterval = setInterval(() => {
      displayProgress = Math.min(displayProgress + 1, 95);
      setScanProgress(displayProgress);
    }, 10000);

    try {
      while (hasMore) {
        const response = await dashboardAPI.scanFaceMatches(personId, offset, LIMIT);

        if (!response.success || !response.data) {
          toast.error(response.error || 'Scan failed. Please try again.');
          break;
        }

        const result = response.data?.data || response.data;
        const { scanned, new_matches, has_more, next_offset, total_unscanned } = result;

        if (totalImages === 0 && total_unscanned && total_unscanned > 0) {
          totalImages = total_unscanned;
        }

        totalNewMatches += new_matches ?? 0;
        totalScanned += scanned ?? 0;
        hasMore = has_more ?? false;
        offset = next_offset ?? offset + LIMIT;

        setScanStatusText(`Scanning ${totalScanned}${totalImages > 0 ? ` of ${totalImages}` : ''} images...`);
      }

      clearInterval(animInterval);
      setScanProgress(100);
      setScanStatusText('Scan complete!');
      setScanNewMatches(totalNewMatches);
      setScanComplete(true);
      // Store person_id so sidebar "See Results" can navigate directly to this face
      onAIScanProgress?.(100, 'completed', personId);
    } catch (err) {
      clearInterval(animInterval);
      toast.error('Scan failed. Please try again.');
      setIsAIScanModalOpen(false);
      onAIScanProgress?.(0, 'failed');
    } finally {
      setIsScanning(false);
      // do NOT reset scanProgress here — let it stay at 100 until modal closes
    }
  };

  // ── Delete state ──
  const [showDeleteFaceConfirm, setShowDeleteFaceConfirm] = useState(false);
  const [isDeletingFace, setIsDeletingFace] = useState(false);
  const [isDeletingPhotos, setIsDeletingPhotos] = useState(false);

  // ── Photo selection ──
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [localPhotos, setLocalPhotos] = useState<Array<{ photo: RawPhoto; memory: RawMemory }>>(
    (face.memories ?? []).flatMap(mem => (mem.photos ?? []).map(p => ({ photo: p, memory: mem })))
  );

  const totalImages = face.total_photos ?? localPhotos.length;

  // Open edit mode — seed fields from current local state
  const openEditMode = () => {
    setEditingName(localName);
    setEditTags([...localTags]);
    setEditTagInput('');
    setEditThumbnailPreview('');
    setEditThumbnailFile(null);
    setIsEditingPersonCard(true);
  };

  const cancelEdit = () => {
    setIsEditingPersonCard(false);
    setEditingName('');
    setEditTags([]);
    setEditTagInput('');
    setEditThumbnailPreview('');
    setEditThumbnailFile(null);
    setShowImageMenu(false);
  };

  // Close image menu on outside click
  useEffect(() => {
    if (!showImageMenu) return;
    const handler = (e: MouseEvent) => {
      if (imageMenuRef.current && !imageMenuRef.current.contains(e.target as Node)) {
        setShowImageMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showImageMenu]);

  // Close avatar menu on outside click
  useEffect(() => {
    if (!showAvatarMenu) return;
    const handler = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAvatarMenu]);

  // Apply crop
  const handleApplyCrop = async () => {
    if (!croppedAreaPixels) return;
    const src = editThumbnailPreview || face.representative_photo;
    if (!src) return;
    setIsCropApplying(true);
    try {
      const { dataUrl, blob } = await getCroppedImg(src, croppedAreaPixels, cropRotation);
      const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' });
      setShowCropModal(false);
      setCropPosition({ x: 0, y: 0 });
      setCropZoom(1);
      setCropRotation(0);
      if (isEditingPersonCard) {
        // Edit modal flow — set preview, let Save button handle upload
        setEditThumbnailFile(file);
        setEditThumbnailPreview(dataUrl);
      } else {
        // Camera icon flow — auto-save directly, no edit modal
        await handleSaveThumbnailOnly(file, dataUrl);
      }
    } catch (err) {
      const isSecurityErr = err instanceof DOMException && err.name === 'SecurityError';
      toast.error(isSecurityErr
        ? 'Cannot crop this image due to security restrictions. Use "Change Image" to upload a new one.'
        : 'Failed to crop image. Try using "Change Image" instead.'
      );
    } finally {
      setIsCropApplying(false);
    }
  };

  // Fetch images for the media picker
  const fetchMediaPickerImages = async () => {
    setIsLoadingMediaPicker(true);
    try {
      const response = await mediaAPI.getMemoryImages();
      if (response?.success && response.data) {
        const images: { id: string; image: string; title: string; tags: string[] }[] = [];
        const seenIds = new Set<string>();
        const addItem = (item: any) => {
          if (item.media_id && item.media_url) {
            const id = item.media_id.toString();
            if (!seenIds.has(id)) {
              seenIds.add(id);
              const rawTags = Array.isArray(item.tags) ? item.tags : [];
              const tags = rawTags.map((t: any) => (typeof t === 'string' ? t : t?.name ?? '')).filter(Boolean) as string[];
              images.push({ id, image: item.media_url, title: item.name || `IMG_${id}`, tags });
            }
          }
        };
        // Handle flat all_media array (newer API format)
        if (response.data.all_media && Array.isArray(response.data.all_media)) {
          response.data.all_media.forEach(addItem);
        } else {
          // Handle legacy categories_media + unassigned_media format
          if (response.data.categories_media) {
            Object.values(response.data.categories_media).forEach((items: any) => {
              if (Array.isArray(items)) items.forEach(addItem);
            });
          }
          if (response.data.unassigned_media && Array.isArray(response.data.unassigned_media)) {
            response.data.unassigned_media.forEach(addItem);
          }
        }
        setMediaPickerImages(images);
      }
    } catch {
      toast.error('Failed to load media library.');
    } finally {
      setIsLoadingMediaPicker(false);
    }
  };

  // Handle selecting an image from the media picker
  const handleSelectFromMediaLibrary = async (imageUrl: string) => {
    setIsMediaPickerOpen(false);
    setMediaPickerSearch('');
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], 'thumbnail.jpg', { type: blob.type || 'image/jpeg' });
      const dataUrl = URL.createObjectURL(blob);
      await handleSaveThumbnailOnly(file, dataUrl);
    } catch {
      toast.error('Failed to use selected image. Try uploading directly.');
    }
  };

  // Save thumbnail only (camera icon flow — no edit modal)
  const handleSaveThumbnailOnly = async (file: File, dataUrl: string) => {
    setLocalThumbnail(dataUrl); // optimistic UI
    try {
      const formData = new FormData();
      formData.append('cluster_id', getRawFaceId(face));
      if (face.person_id != null) formData.append('person_id', String(face.person_id));
      formData.append('thumbnail', file, 'thumbnail.jpg');
      const token = localStorage.getItem('stasht_token');
      const res = await fetch(`${getApiBaseUrl()}/ai/face-cluster/update`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      const data = await res.json();
      if (data.success) toast.success('Photo updated');
      else toast.error(data.message || 'Failed to save photo.');
    } catch {
      toast.error('Failed to save photo.');
    }
  };

  // Save person details — exact same approach as MemoryDetailsPage
  const handleSavePersonDetails = async () => {
    const trimmedName = editingName.trim();

    // Optimistic UI update
    if (trimmedName) setLocalName(trimmedName);
    setLocalTags([...editTags]);
    if (editThumbnailPreview) setLocalThumbnail(editThumbnailPreview);
    setIsEditingPersonCard(false);
    setEditTagInput('');
    setEditThumbnailPreview('');
    setEditThumbnailFile(null);

    const formData = new FormData();
    formData.append('cluster_id', getRawFaceId(face));
    if (face.person_id != null) formData.append('person_id', String(face.person_id));
    if (trimmedName) formData.append('name', trimmedName);
    editTags.forEach(tag => formData.append('tags[]', tag));

    if (editThumbnailFile) {
      formData.append('thumbnail', editThumbnailFile, 'thumbnail.jpg');
    }

    try {
      const token = localStorage.getItem('stasht_token');
      const res = await fetch(`${getApiBaseUrl()}/ai/face-cluster/update`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Person details saved');
      } else {
        toast.error('Failed to save person details. Please try again.');
      }
    } catch {
      toast.error('Failed to save person details. Please try again.');
    }
  };

  // Delete full face/person
  const handleDeleteFace = async () => {
    setIsDeletingFace(true);
    try {
      const response = await dashboardAPI.deleteFace(String(face.person_id));
      if (response.success) {
        toast.success('Person deleted successfully.');
        onFaceDeleted();
      } else {
        toast.error(response.error || 'Failed to delete person.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsDeletingFace(false);
      setShowDeleteFaceConfirm(false);
    }
  };

  // Delete selected photos
  const handleDeleteSelectedPhotos = async () => {
    if (selectedPhotos.size === 0) return;
    setIsDeletingPhotos(true);
    const successKeys: Set<string> = new Set();

    await Promise.all(
      localPhotos.map(async ({ photo }, i) => {
        const key = `${localPhotos[i].memory.memory_id}-${i}`;
        if (!selectedPhotos.has(key)) return;
        const photoId = getPhotoId(photo);
        console.log(`🗑️ Deleting face photo — key: ${key}, photoId: ${photoId}, photo:`, photo);
        if (!photoId) {
          toast.error('Photo ID missing — cannot delete.');
          return;
        }
        try {
          const response = await dashboardAPI.deleteFacePhoto(photoId);
          if (response.success) successKeys.add(key);
          else toast.error('Failed to delete a photo.');
        } catch {
          toast.error('Error deleting a photo.');
        }
      })
    );

    setLocalPhotos(prev => prev.filter((_, i) => {
      const key = `${prev[i].memory.memory_id}-${i}`;
      return !successKeys.has(key);
    }));
    setSelectedPhotos(new Set());
    setIsDeletingPhotos(false);
    if (successKeys.size > 0) {
      toast.success(`${successKeys.size} photo${successKeys.size > 1 ? 's' : ''} deleted.`);
    }
  };

  const togglePhoto = (key: string) => {
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Current thumbnail to display (priority: local saved > original)
  const displayThumbnail = localThumbnail || face.thumbnail || face.representative_photo;

  return (
    <div className="min-h-screen bg-white pt-4 pl-4 pr-4 pb-4">
      <div className="bg-white rounded-xl border border-gray-200 flex flex-col min-h-[calc(100vh-2rem)]">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between gap-4 sticky top-20 z-10 bg-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Person Details</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setIsAddPersonOpen(true); setAddPersonName(localName); }} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Plus className="w-4 h-4" /> Add
            </button>
            <div className="relative">
              <button
                onClick={handleAIScanClick}
                disabled={isScanning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #6C60FF, #EC4899) border-box',
                  border: '1px solid transparent',
                }}
              >
                <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: '#6C60FF' }} />
                <span style={{
                  background: 'linear-gradient(to right, #6C60FF, #EC4899)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  display: 'inline-block',
                }}>
                  AI Scan
                </span>
              </button>

              {/* Credits Confirmation Popover */}
              {isCreditsModalOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsCreditsModalOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-5">
                    {isCheckingCredits ? (
                      <div className="flex items-center justify-center gap-3 py-3">
                        <svg className="w-4 h-4 animate-spin text-[#6C60FF]" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        <span className="text-sm text-gray-500">Checking credits...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: '#6C60FF' }} />
                          <h3 className="text-[15px] font-semibold text-gray-900">AI Scan Confirmation</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                          This action will consume <strong>2 credits</strong> to analyze and detect faces in your campaign photos.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setIsCreditsModalOpen(false)}
                            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          {creditsCheck?.has_sufficient_credits && (
                            <button
                              onClick={handleScanFace}
                              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
                              style={{ background: 'linear-gradient(to right, #6C60FF, #EC4899)' }}
                            >
                              Yes, Scan Photos
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setShowDeleteFaceConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete Person
            </button>
          </div>
        </div>

        {/* ── Add more AI Credits Modal ── */}
        {isAddCreditsModalOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[380px] p-5 relative">
              {/* Close */}
              <button
                onClick={() => setIsAddCreditsModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header row: icon + title + subtitle */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-[#F3E8FF] flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-[#9333EA]" fill="#9333EA" />
                </div>
                <div>
                  <h2 className="text-base font-medium text-gray-900 leading-tight">Add more AI Credits</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{creditsCheck?.total_available ?? 0} Credits</p>
                </div>
              </div>

              {/* Body */}
              <p className="text-gray-700 text-sm leading-relaxed mb-5">
                You have run out of Ai credits. Please purchase more to continue.
              </p>

              {/* Button */}
              <button
                onClick={() => {
                  setIsAddCreditsModalOpen(false);
                  sessionStorage.setItem('openPurchaseCreditsModal', 'true');
                  onNavigate?.('billing');
                }}
                className="w-full h-12 rounded-xl bg-[#9333EA] hover:bg-[#7E22CE] text-white font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Zap className="w-4 h-4" fill="white" />
                Buy more Credits
              </button>
            </div>
          </div>
        )}

        <div className="px-6 py-5 space-y-6 flex-1">

          {/* Hidden file input for edit modal flow */}
          <input
            ref={thumbInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setEditThumbnailFile(file);
                setEditThumbnailPreview(URL.createObjectURL(file));
              }
              e.target.value = '';
            }}
          />
          {/* Hidden file input for camera icon flow — auto-saves without edit modal */}
          <input
            ref={avatarThumbInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const dataUrl = URL.createObjectURL(file);
                await handleSaveThumbnailOnly(file, dataUrl);
              }
              e.target.value = '';
            }}
          />

          {/* ── Add Person to Library Modal ── */}
          <Dialog open={isAddPersonOpen} onOpenChange={(open) => {
            setIsAddPersonOpen(open);
            if (!open) {
              setAddPersonPhotos([]);
              setAddPersonPhotoUrls([]);
              setAddPersonPhotoPreviews([]);
              setAddPersonName('');
              setAddPersonTagInput('');
              setAddPersonTags([]);
            }
          }}>
            <DialogContent className="max-w-none md:max-w-[440px] w-full md:h-auto bg-white p-0 md:p-6 border-0 shadow-xl md:rounded-lg rounded-none top-0 left-0 translate-x-0 translate-y-0 md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%] [&>button[data-slot=dialog-default-close]]:hidden md:[&>button[data-slot=dialog-default-close]]:flex">
              {/* Mobile Header */}
              <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <h4 className="font-semibold text-[18px] text-gray-900">Add Person to Library</h4>
                <DialogClose asChild>
                  <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:bg-gray-100 rounded-full">
                    <X className="!w-[28px] !h-[28px] text-black" />
                  </Button>
                </DialogClose>
              </div>
              {/* Desktop Header */}
              <DialogHeader className="pb-4 border-b border-gray-200 hidden md:block">
                <DialogTitle className="text-lg font-bold text-gray-900">Add Person to Library</DialogTitle>
              </DialogHeader>

              <div className="space-y-5 pt-2 px-5 md:px-0">
                {/* Photo Upload */}
                <div className="space-y-2">
                  <label className="text-[14px] md:text-sm font-medium text-gray-700">Photo</label>
                  <div className="relative" ref={photoSourceMenuRef} onMouseLeave={() => setShowPhotoSourceMenu(false)}>
                    {/* Thumbnail view after upload */}
                    {addPersonPhotoPreviews.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {addPersonPhotoPreviews.map((preview, idx) => (
                          <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden shadow-sm border border-gray-200">
                            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              onClick={(e) => { e.stopPropagation(); setAddPersonPhotoPreviews(prev => prev.filter((_, i) => i !== idx)); setAddPersonPhotos(prev => prev.filter((_, i) => i !== idx)); }}
                              className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        ))}
                        <div
                          className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#6C60FF] hover:bg-[#6C60FF]/5 transition-colors"
                          onClick={() => setShowPhotoSourceMenu(prev => !prev)}
                        >
                          <Plus className="w-5 h-5 text-gray-400 mb-1" />
                          <span className="text-xs text-gray-400">Add more</span>
                        </div>
                      </div>
                    ) : (
                      /* Upload area — no image yet */
                      <div
                        className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#6C60FF] hover:bg-[#6C60FF]/5 transition-colors"
                        onClick={() => setShowPhotoSourceMenu(prev => !prev)}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (file && file.type.startsWith('image/')) {
                            setAddPersonPhotos(prev => [...prev, file]);
                            setAddPersonPhotoPreviews(prev => [...prev, URL.createObjectURL(file)]);
                            setShowPhotoSourceMenu(false);
                          }
                        }}
                      >
                        <Plus className="w-6 h-6 text-gray-400 mb-1" />
                        <span className="text-sm text-gray-500">Upload photo or drag photos</span>
                      </div>
                    )}

                    {/* Source popover */}
                    {showPhotoSourceMenu && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-52">
                        <button
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            setShowPhotoSourceMenu(false);
                            setIsAddPersonMediaPickerOpen(true);
                            fetchMediaPickerImages();
                          }}
                        >
                          <ImageIcon className="w-4 h-4 text-gray-500" />
                          Media Library
                        </button>
                        <button
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            setShowPhotoSourceMenu(false);
                            addPersonFileInputRef.current?.click();
                          }}
                        >
                          <Camera className="w-4 h-4 text-gray-500" />
                          Upload from Device
                        </button>
                      </div>
                    )}

                    {/* Hidden file input */}
                    <input
                      ref={addPersonFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setAddPersonPhotos(prev => [...prev, file]);
                          setAddPersonPhotoPreviews(prev => [...prev, URL.createObjectURL(file)]);
                        }
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>

                {/* Name Input */}
                <div className="space-y-2">
                  <label className="text-[14px] md:text-sm font-medium text-gray-700">Name</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                    <Input
                      placeholder="Enter name"
                      value={addPersonName}
                      onChange={(e) => setAddPersonName(e.target.value)}
                      className="pl-8 h-10 border-gray-300 focus:border-[#6C60FF] focus:ring-[#6C60FF]"
                    />
                  </div>
                </div>

                {/* Tags Input */}
                <div className="space-y-2">
                  <label className="text-[14px] md:text-sm font-medium text-gray-700">Tags</label>
                  {addPersonTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {addPersonTags.map((tag, index) => (
                        <Badge key={index} className="bg-[#6C60FF]/10 text-[#6C60FF] border-0 text-xs px-2 py-0.5 flex items-center gap-1">
                          {tag}
                          <X className="w-3 h-3 cursor-pointer" onClick={() => setAddPersonTags(prev => prev.filter((_, i) => i !== index))} />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Add a tag"
                      value={addPersonTagInput}
                      onChange={(e) => setAddPersonTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && addPersonTagInput.trim()) {
                          e.preventDefault();
                          setAddPersonTags(prev => [...prev, addPersonTagInput.trim()]);
                          setAddPersonTagInput('');
                        }
                      }}
                      className="flex-1 h-10 border-gray-300 focus:border-[#6C60FF] focus:ring-[#6C60FF]"
                    />
                    <Button
                      size="sm"
                      className="h-10 px-4 bg-[#6C60FF] hover:bg-[#5A52E6] text-white"
                      onClick={() => {
                        if (addPersonTagInput.trim()) {
                          setAddPersonTags(prev => [...prev, addPersonTagInput.trim()]);
                          setAddPersonTagInput('');
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-5 py-4 md:px-0 md:py-0 md:pt-5 border-t border-gray-200 md:mt-5">
                <Button variant="outline" onClick={() => setIsAddPersonOpen(false)} className="h-12 md:h-10 px-6 text-[14px] md:text-sm border-gray-300 text-gray-700 hover:bg-gray-50">
                  Cancel
                </Button>
                <Button
                  className="h-12 md:h-10 px-6 text-[14px] md:text-sm bg-[#6C60FF] hover:bg-[#5A52E6] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isAddingPerson}
                  onClick={async () => {
                    if (!addPersonPhotoUrls.length && !addPersonPhotos.length) { toast.error('Please select a photo.'); return; }
                    if (!addPersonName.trim()) { toast.error('Please enter a name.'); return; }
                    setIsAddingPerson(true);
                    try {
                      const token = localStorage.getItem('stasht_token');
                      let res: Response;
                      if (addPersonPhotoUrls.length > 0) {
                        // Media library selection — send JSON with URL
                        res = await fetch(`${getApiBaseUrl()}/ai/face-cluster/create`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                          body: JSON.stringify({
                            person_id: String(face.person_id),
                            name: addPersonName.trim(),
                            tags: addPersonTags,
                            image_url: addPersonPhotoUrls[0].url,
                            media_id: addPersonPhotoUrls[0].mediaId,
                          }),
                        });
                      } else {
                        // Device upload — send FormData with blob
                        const formData = new FormData();
                        formData.append('thumbnail', addPersonPhotos[0], 'thumbnail.jpg');
                        formData.append('person_id', String(face.person_id));
                        formData.append('name', addPersonName.trim());
                        addPersonTags.forEach(tag => formData.append('tags[]', tag));
                        res = await fetch(`${getApiBaseUrl()}/ai/face-cluster/create`, {
                          method: 'POST',
                          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                          body: formData,
                        });
                      }
                      const data = await res.json();
                      if (data.status === 'success') {
                        // Save media_ids to localStorage for greying in future picker opens
                        if (addPersonPhotoUrls.length > 0 && face.person_id) {
                          const storageKey = `stasht_person_media_${face.person_id}`;
                          const stored: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
                          const newIds = addPersonPhotoUrls.map(p => p.mediaId);
                          localStorage.setItem(storageKey, JSON.stringify([...new Set([...stored, ...newIds])]));
                        }
                        toast.success('Person added to library');
                        setIsAddPersonOpen(false);
                        setAddPersonPhotos([]);
                        setAddPersonPhotoUrls([]);
                        setAddPersonPhotoPreviews([]);
                        setAddPersonName('');
                        setAddPersonTagInput('');
                        setAddPersonTags([]);
                        onPersonAdded?.();
                      } else {
                        toast.error(data.message || 'Failed to add person.');
                      }
                    } catch {
                      toast.error('Something went wrong. Please try again.');
                    } finally {
                      setIsAddingPerson(false);
                    }
                  }}
                >
                  {isAddingPerson ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Adding...</> : 'Add Person'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* ── Media Library Picker Modal ── */}
          {isMediaPickerOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => { setIsMediaPickerOpen(false); setMediaPickerSearch(''); }}>
              <div className="relative bg-white rounded-xl shadow-xl w-[720px] max-w-[95vw] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center justify-center w-10 h-10 bg-[#6C60FF]/10 rounded-lg">
                    <ImageIcon className="w-5 h-5 text-[#6C60FF]" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-900">Media Library</h2>
                    <p className="text-sm text-gray-500">Select a photo to use as profile image</p>
                  </div>
                  <button onClick={() => { setIsMediaPickerOpen(false); setMediaPickerSearch(''); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* Search */}
                <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search photos..."
                      value={mediaPickerSearch}
                      onChange={e => setMediaPickerSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
                    />
                  </div>
                </div>
                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  {isLoadingMediaPicker ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-8 h-8 text-[#6C60FF] animate-spin" />
                    </div>
                  ) : mediaPickerImages.filter(img => !mediaPickerSearch || img.title.toLowerCase().includes(mediaPickerSearch.toLowerCase()) || img.tags.some(t => t.toLowerCase().includes(mediaPickerSearch.toLowerCase()))).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <ImageIcon className="w-10 h-10 mb-2" />
                      <p className="text-sm">No photos found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {mediaPickerImages
                        .filter(img => !mediaPickerSearch || img.title.toLowerCase().includes(mediaPickerSearch.toLowerCase()) || img.tags.some(t => t.toLowerCase().includes(mediaPickerSearch.toLowerCase())))
                        .map(img => (
                          <button
                            key={img.id}
                            onClick={() => handleSelectFromMediaLibrary(img.image)}
                            className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-[#6C60FF] transition-all group"
                          >
                            <img src={img.image} alt={img.title} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                          </button>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Media Picker for Add Person ── */}
          <Dialog open={isAddPersonMediaPickerOpen} onOpenChange={(open) => { if (!open) { setIsAddPersonMediaPickerOpen(false); setMediaPickerSearch(''); setAddPersonMediaPickerSelected(new Set()); } }}>
            <DialogPortal>
              <DialogOverlay className="z-[200]" />
              <DialogPrimitive.Content className="fixed top-[50%] left-[50%] z-[201] translate-x-[-50%] translate-y-[-50%] w-[720px] max-w-[95vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-xl outline-none">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center justify-center w-10 h-10 bg-[#6C60FF]/10 rounded-lg">
                    <ImageIcon className="w-5 h-5 text-[#6C60FF]" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-900">Media Library</h2>
                    <p className="text-sm text-gray-500">Select a photo for this person</p>
                  </div>
                  <button onClick={() => { setIsAddPersonMediaPickerOpen(false); setMediaPickerSearch(''); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search photos..." value={mediaPickerSearch} onChange={e => setMediaPickerSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {isLoadingMediaPicker ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-[#6C60FF] animate-spin" /></div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {(() => {
                        const stripQuery = (url: string) => url.split('?')[0];
                        const getFilename = (url: string) => stripQuery(url).split('/').pop() ?? '';
                        const existingKeys = new Set<string>();
                        localPhotos.forEach(({ photo }) => {
                          if (photo.media_id != null) existingKeys.add(String(photo.media_id));
                          if (photo.photo_id != null) existingKeys.add(String(photo.photo_id));
                          if (photo.face_photo_id != null) existingKeys.add(String(photo.face_photo_id));
                          [photo.url, photo.photo_url, photo.image_url, photo.file_url, photo.path, photo.thumbnail].forEach(u => {
                            if (u) {
                              existingKeys.add(u);
                              existingKeys.add(stripQuery(u));
                              existingKeys.add(getFilename(u));
                            }
                          });
                        });
                        // Also include media_ids saved from previous picker selections
                        const storedMediaIds: string[] = JSON.parse(localStorage.getItem(`stasht_person_media_${face.person_id}`) || '[]');
                        storedMediaIds.forEach(id => existingKeys.add(id));
                        return mediaPickerImages
                          .filter(img => !mediaPickerSearch || img.title.toLowerCase().includes(mediaPickerSearch.toLowerCase()) || img.tags.some(t => t.toLowerCase().includes(mediaPickerSearch.toLowerCase())))
                          .map((img) => {
                            const isAlreadyAdded =
                              existingKeys.has(img.id) ||
                              existingKeys.has(img.image) ||
                              existingKeys.has(stripQuery(img.image)) ||
                              existingKeys.has(getFilename(img.image));
                            const isSelected = addPersonMediaPickerSelected.has(img.id);
                            return (
                              <div
                                key={img.id}
                                onClick={() => {
                                  if (isAlreadyAdded) return;
                                  setAddPersonMediaPickerSelected(prev => {
                                    const next = new Set(prev);
                                    next.has(img.id) ? next.delete(img.id) : next.add(img.id);
                                    return next;
                                  });
                                }}
                                className={`relative aspect-square rounded-lg overflow-hidden bg-gray-100 transition-all ${isAlreadyAdded ? 'cursor-not-allowed' : isSelected ? 'cursor-pointer ring-2 ring-[#6C60FF]' : 'cursor-pointer hover:ring-2 hover:ring-[#6C60FF]/50'}`}
                              >
                                <img src={img.image} alt={img.title} className="w-full h-full object-cover" />
                                <div className="absolute top-2 left-2" onClick={e => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isSelected}
                                    disabled={isAlreadyAdded}
                                    onCheckedChange={() => {
                                      if (isAlreadyAdded) return;
                                      setAddPersonMediaPickerSelected(prev => {
                                        const next = new Set(prev);
                                        next.has(img.id) ? next.delete(img.id) : next.add(img.id);
                                        return next;
                                      });
                                    }}
                                    className={`w-8 h-8 rounded-xl border-2 shadow-sm [&_svg]:w-5 [&_svg]:h-5 ${isAlreadyAdded ? 'bg-gray-200 border-gray-300 opacity-50 cursor-not-allowed' : 'bg-white border-gray-300 data-[state=checked]:bg-[#6C60FF] data-[state=checked]:border-[#6C60FF] data-[state=checked]:text-white'}`}
                                  />
                                </div>
                              </div>
                            );
                          });
                      })()}
                    </div>
                  )}
                </div>
                {/* Done button footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                  <button
                    onClick={() => { setIsAddPersonMediaPickerOpen(false); setMediaPickerSearch(''); setAddPersonMediaPickerSelected(new Set()); }}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={addPersonMediaPickerSelected.size === 0}
                    onClick={() => {
                      const selectedImgs = mediaPickerImages.filter(img => addPersonMediaPickerSelected.has(img.id));
                      setIsAddPersonMediaPickerOpen(false);
                      setMediaPickerSearch('');
                      setAddPersonMediaPickerSelected(new Set());
                      selectedImgs.forEach(img => {
                        setAddPersonPhotoUrls(prev => [...prev, { url: img.image, mediaId: img.id }]);
                        setAddPersonPhotoPreviews(prev => [...prev, img.image]);
                      });
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#6C60FF] hover:bg-[#5A52E6] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {addPersonMediaPickerSelected.size > 0 ? `Add ${addPersonMediaPickerSelected.size} Photo${addPersonMediaPickerSelected.size > 1 ? 's' : ''}` : 'Add Photos'}
                  </button>
                </div>
              </DialogPrimitive.Content>
            </DialogPortal>
          </Dialog>

          {/* ── Edit Person Modal ── */}
          {isEditingPersonCard && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={cancelEdit}>
              <div className="bg-white rounded-xl shadow-xl p-5 w-[420px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
                {/* Thumbnail + title row */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-shrink-0" ref={imageMenuRef}>
                    <div
                      className="relative group/thumb cursor-pointer w-12 h-12 rounded-lg overflow-hidden bg-gray-100"
                      onClick={() => setShowImageMenu(prev => !prev)}
                    >
                      {editThumbnailPreview ? (
                        <img src={editThumbnailPreview} alt="thumbnail" className="w-full h-full object-cover" />
                      ) : displayThumbnail ? (
                        face.thumbnail || localThumbnail ? (
                          <img src={displayThumbnail} alt="thumbnail" className="w-full h-full object-cover" />
                        ) : (
                          <FaceCropFill
                            src={displayThumbnail}
                            bbox={face.representative_bbox ?? face.memories?.[0]?.photos?.[0]?.bounding_box ?? null}
                          />
                        )
                      ) : (
                        <div className="w-full h-full bg-gray-200" />
                      )}
                      <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                        <Camera className="w-4 h-4 text-white" />
                      </div>
                    </div>

                    {/* Image action menu */}
                    {showImageMenu && (
                      <div className="absolute top-14 left-0 z-[60] bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                        <button
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            setShowImageMenu(false);
                            setShowCropModal(true);
                            setCropPosition({ x: 0, y: 0 });
                            setCropZoom(1);
                            setCropRotation(0);
                          }}
                        >
                          <Crop className="w-4 h-4 text-gray-500" />
                          Crop Image
                        </button>
                        <button
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            setShowImageMenu(false);
                            thumbInputRef.current?.click();
                          }}
                        >
                          <ImageIcon className="w-4 h-4 text-gray-500" />
                          Change Image
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-900">Edit Person</p>
                    <p className="text-xs text-gray-400">Click image to edit</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Name</label>
                    <input
                      autoFocus
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSavePersonDetails();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6C60FF] focus:ring-1 focus:ring-[#6C60FF]/20"
                      placeholder="Enter name..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Tags</label>
                    {editTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {editTags.map((tag, i) => (
                          <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-[#EFEFEF] text-gray-800 text-xs rounded-full border border-gray-200">
                            {tag}
                            <button
                              onClick={() => setEditTags(prev => prev.filter((_, idx) => idx !== i))}
                              className="hover:text-red-500 leading-none ml-0.5"
                            >×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      value={editTagInput}
                      onChange={e => setEditTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && editTagInput.trim()) {
                          setEditTags(prev => [...prev, editTagInput.trim()]);
                          setEditTagInput('');
                        }
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6C60FF] focus:ring-1 focus:ring-[#6C60FF]/20"
                      placeholder="Type tag and press Enter..."
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSavePersonDetails}
                      className="flex-1 bg-[#6C60FF] text-white text-sm font-medium rounded-lg py-2 hover:bg-[#5B52FF] transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex-1 border border-gray-200 text-gray-600 text-sm rounded-lg py-2 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Crop Modal ── */}
          {showCropModal && (
            <div className="fixed inset-0 z-[70] flex flex-col bg-black">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
                <button
                  onClick={() => { setShowCropModal(false); setCropPosition({ x: 0, y: 0 }); setCropZoom(1); setCropRotation(0); }}
                  className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm transition-colors"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <span className="text-white text-sm font-medium">Crop Image</span>
                <button
                  onClick={handleApplyCrop}
                  disabled={isCropApplying}
                  className="flex items-center gap-1.5 bg-[#6C60FF] hover:bg-[#5B52FF] text-white text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {isCropApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isCropApplying ? 'Applying...' : 'Apply'}
                </button>
              </div>

              {/* Cropper area */}
              <div className="relative flex-1">
                <Cropper
                  image={editThumbnailPreview || face.representative_photo || ''}
                  crop={cropPosition}
                  zoom={cropZoom}
                  rotation={cropRotation}
                  aspect={1}
                  onCropChange={setCropPosition}
                  onZoomChange={setCropZoom}
                  onCropComplete={(_: Area, pixels: Area) => setCroppedAreaPixels(pixels)}
                />
              </div>

              {/* Zoom + Rotate controls */}
              <div className="flex flex-col gap-3 px-6 py-4 bg-black/80">
                {/* Zoom slider */}
                <div className="flex items-center gap-3">
                  <span className="text-white/60 text-xs w-10">Zoom</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={cropZoom}
                    onChange={e => setCropZoom(Number(e.target.value))}
                    className="flex-1 accent-[#6C60FF]"
                  />
                </div>
                {/* Rotate buttons */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setCropRotation(r => (r - 90 + 360) % 360)}
                    className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs transition-colors px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Rotate Left
                  </button>
                  <span className="text-white/40 text-xs">{cropRotation}°</span>
                  <button
                    onClick={() => setCropRotation(r => (r + 90) % 360)}
                    className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs transition-colors px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/50"
                  >
                    Rotate Right
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Person Info Card ── */}
          <div
            className="border border-gray-200 rounded-xl p-4 flex gap-4 relative group cursor-pointer hover:shadow-md transition-shadow"
            onClick={openEditMode}
          >
              {/* Pencil icon top-right on hover */}
              <button
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm text-gray-500 hover:bg-[#6C60FF] hover:text-white hover:border-[#6C60FF]"
                onClick={e => { e.stopPropagation(); openEditMode(); }}
              >
                <Edit className="w-3.5 h-3.5" />
              </button>

              {/* Avatar — hover shows camera icon, click opens Crop/Change Image menu */}
              <div
                className="relative shrink-0"
                ref={avatarMenuRef}
                onClick={e => e.stopPropagation()}
              >
                <div
                  className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 cursor-pointer relative group/avatar"
                  onClick={() => setShowAvatarMenu(prev => !prev)}
                >
                  {displayThumbnail ? (
                    face.thumbnail || localThumbnail ? (
                      <img src={displayThumbnail} alt="person" className="w-full h-full object-cover" />
                    ) : (
                      <FaceCropFill
                        src={displayThumbnail}
                        bbox={face.representative_bbox ?? face.memories?.[0]?.photos?.[0]?.bounding_box ?? null}
                      />
                    )
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                  {/* Camera overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>

                {/* Avatar action dropdown */}
                {showAvatarMenu && (
                  <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                    <button
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        setShowAvatarMenu(false);
                        setShowCropModal(true);
                        setCropPosition({ x: 0, y: 0 });
                        setCropZoom(1);
                        setCropRotation(0);
                      }}
                    >
                      <Crop className="w-4 h-4 text-gray-500" />
                      Crop Image
                    </button>
                    <button
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        setShowAvatarMenu(false);
                        setIsMediaPickerOpen(true);
                        fetchMediaPickerImages();
                      }}
                    >
                      <ImageIcon className="w-4 h-4 text-gray-500" />
                      Change Image
                    </button>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-900">{localName}</span>
                </div>
                <p className="text-sm text-gray-500">{totalImages} images</p>
                <div className="flex flex-wrap gap-1.5">
                  {localTags.map((tag, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
          </div>

          {/* Campaigns Grid */}
          {localPhotos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900">
                  Moments ({localPhotos.length})
                </h2>
                {selectedPhotos.size > 0 && (
                  <button
                    onClick={handleDeleteSelectedPhotos}
                    disabled={isDeletingPhotos}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeletingPhotos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete {selectedPhotos.size} photo{selectedPhotos.size > 1 ? 's' : ''}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {localPhotos.map(({ photo, memory }, i) => {
                  const key = `${memory.memory_id}-${i}`;
                  return (
                    <PhotoStoryCard
                      key={key}
                      photo={photo}
                      memoryTitle={memory.memory_title}
                      memoryDate={memory.memory_date}
                      selected={selectedPhotos.has(key)}
                      onToggle={() => togglePhoto(key)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {localPhotos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-gray-400 text-sm">No photos available for this person.</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Face Confirm Dialog */}
      {/* ── AI Scan Progress Modal ── */}
      {isAIScanModalOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />

          {/* Modal card */}
          <div
              className="fixed z-50 bg-white"
              style={{
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                borderRadius: '16px',
                width: '480px',
                padding: '32px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              {scanComplete ? (
                /* ── Scan complete view ── */
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-1">Scan Complete!</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    {scanNewMatches > 0
                      ? `Found ${scanNewMatches} new match${scanNewMatches > 1 ? 'es' : ''} in your campaigns.`
                      : 'No new matches found in your campaigns.'}
                  </p>
                  <button
                    onClick={() => {
                      setIsAIScanModalOpen(false);
                      setScanComplete(false);
                      onScanComplete?.();
                    }}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(to right, #6C60FF, #EC4899)' }}
                  >
                    <Sparkles className="w-4 h-4" />
                    See Results
                  </button>
                </div>
              ) : (
                /* ── Scanning in progress view ── */
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100">
                      <Sparkles className="w-7 h-7" style={{ color: '#6C60FF' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-base">AI Scan</h3>
                      <p className="text-sm text-gray-500">Scanning campaigns for face matches...</p>
                    </div>
                  </div>
                  <div className="flex justify-center my-6">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full border-4 border-gray-200 animate-pulse" />
                      <div
                        className="absolute inset-0 w-20 h-20 rounded-full border-4 border-t-transparent animate-spin"
                        style={{ borderColor: '#6C60FF', borderTopColor: 'transparent' }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-8 h-8" style={{ color: '#EC4899' }} />
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-600 mb-6">
                    Searching all your campaign images to find faces that match this person.
                  </p>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${scanProgress}%`, background: 'linear-gradient(to right, #6C60FF, #EC4899)' }}
                    />
                  </div>
                  <p className="text-sm text-center text-gray-500 mt-3">{scanStatusText} {scanProgress > 0 ? `${scanProgress}%` : ''}</p>
                </>
              )}
            </div>
        </>
      )}

      {showDeleteFaceConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Delete Person</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              This will permanently delete <strong>Person {personNumber}</strong> and all their face data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteFaceConfirm(false)}
                disabled={isDeletingFace}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFace}
                disabled={isDeletingFace}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeletingFace ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Library Page ────────────────────────────────────────────────────────

export default function LibraryPage({ onNavigate, onAIScanProgress, pendingFacePersonId, onClearPendingFace }: { onNavigate?: (page: string) => void; onAIScanProgress?: (progress: number, status?: 'processing' | 'completed' | 'failed', personId?: string) => void; pendingFacePersonId?: string | null; onClearPendingFace?: () => void; } = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [people, setPeople] = useState<PersonCard[]>([]);
  const [rawFaces, setRawFaces] = useState<RawFace[]>([]);
  const [totalFaces, setTotalFaces] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFaceIdx, setSelectedFaceIdx] = useState<number | null>(null);
  const [facesRefreshKey, setFacesRefreshKey] = useState(0);

  // Merge selection state
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [isMerging, setIsMerging] = useState(false);

  const fetchFaces = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await dashboardAPI.getLibraryFaces();

      if (response.success && response.data) {
        const payload = response.data?.data ?? response.data;
        const facesArray: RawFace[] = payload?.faces ?? [];
        const total: number = payload?.total_unique_faces ?? facesArray.length;

        setTotalFaces(total);
        setRawFaces(facesArray);
        setPeople(facesArray.map((f, i) => normalizeFace(f, i)));
        setFacesRefreshKey(prev => prev + 1);

      } else {
        setError(response.error ?? 'Failed to load library.');
      }
    } catch (err) {
      console.error('❌ Library faces fetch error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFaces();
    // One-time backfill: generates missing thumbnails for faces that don't have one yet
    if (!localStorage.getItem('stasht_face_thumbnails_backfilled_v5')) {
      dashboardAPI.backfillFaceThumbnails().then(() => {
        localStorage.setItem('stasht_face_thumbnails_backfilled_v5', '1');
      }).catch(() => {/* silent fail */});
    }
  }, []);

  // Auto-open face detail when returning from scan completion
  useEffect(() => {
    if (!pendingFacePersonId) return;
    if (rawFaces.length === 0) {
      // Faces not loaded yet — fetch them first
      fetchFaces();
      return;
    }
    const idx = rawFaces.findIndex(f => String(f.person_id) === pendingFacePersonId);
    if (idx !== -1) {
      setSelectedFaceIdx(idx);
      onClearPendingFace?.();
    }
  }, [pendingFacePersonId, rawFaces]);

  // Show detail view
  const selectedFace = selectedFaceIdx !== null ? rawFaces[selectedFaceIdx] ?? null : null;
  const selectedFaceNumber = selectedFaceIdx !== null ? selectedFaceIdx + 1 : 1;

  if (selectedFace) {
    return (
      <PersonDetailView
        key={`${selectedFaceIdx}-${facesRefreshKey}`}
        face={selectedFace}
        personNumber={selectedFaceNumber}
        onBack={() => { setSelectedFaceIdx(null); fetchFaces(); }}
        onFaceDeleted={() => {
          setSelectedFaceIdx(null);
          fetchFaces();
        }}
        onNavigate={onNavigate}
        onAIScanProgress={onAIScanProgress}
        onScanComplete={fetchFaces}
        onPersonAdded={fetchFaces}
      />
    );
  }

  const filtered = people.filter(person => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    const nameMatch = person.name.toLowerCase().includes(q);
    const numberFallback = !person.name && `person ${person.number}`.includes(q);
    return nameMatch || numberFallback;
  });

  const toggleMergeSelect = (id: string) => {
    setSelectedForMerge(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleMerge = async () => {
    const ids = Array.from(selectedForMerge);
    if (ids.length < 2) return;

    // Resolve actual Rekognition face_ids from rawFaces.
    // person.id may be an index fallback ("0","1") if the API didn't return face_id/cluster_id,
    // so we use rawIndex to look up the original face object and pull face_id directly.
    const faceUUIDs = ids.map(personId => {
      const card = people.find(p => p.id === personId);
      if (!card) return null;
      const raw = rawFaces[card.rawIndex];
      return raw?.person_id ? String(raw.person_id) : null;
    }).filter(Boolean) as string[];

    if (faceUUIDs.length < 2) {
      toast.error('Could not resolve face IDs for merge. Please try again.');
      return;
    }

    const [primaryFaceId, ...faceIds] = faceUUIDs;
    setIsMerging(true);
    try {
      const response = await dashboardAPI.mergeFaces(primaryFaceId, faceIds);
      if (response.success) {
        toast.success('Faces merged successfully.');
        setSelectedForMerge(new Set());
        fetchFaces();
      } else {
        toast.error(response.error || 'Failed to merge faces.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pt-4 pl-4 pr-4 pb-4">
      <div className="bg-white rounded-xl border border-gray-200 flex flex-col min-h-[calc(100vh-2rem)]">

        {/* Sticky area: header + search + merge bar */}
        <div className="sticky top-20 z-30 bg-white rounded-t-xl">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900">Library</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isLoading ? 'Loading...' : `${totalFaces} people in your library`}
            </p>
          </div>
          {/* Search */}
          <div className="px-6 py-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by person name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
              />
            </div>
          </div>

          {/* Merge Bar — appears when 2+ faces selected */}
          {selectedForMerge.size >= 2 && (
          <div className="mx-6 mb-4 rounded-xl px-5 py-3 flex items-center justify-between gap-4" style={{ backgroundColor: 'rgb(246, 51, 154)' }}>
            <span className="text-white text-sm font-medium">
              {selectedForMerge.size} faces selected — first selected will be kept as primary
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedForMerge(new Set())}
                className="px-3 py-1.5 text-sm text-white/80 hover:text-white border border-white/30 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={isMerging}
                className="flex items-center gap-2 px-4 py-1.5 bg-white text-sm font-semibold rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ color: 'rgb(246, 51, 154)' }}
              >
                {isMerging ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isMerging ? 'Merging...' : `Merge ${selectedForMerge.size} Faces`}
              </button>
            </div>
          </div>
          )}
        </div>{/* end sticky area */}

        {/* Grid / States */}
        <div className="px-6 pb-8 flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-[#6C60FF] animate-spin" />
              <p className="text-sm text-gray-500">Loading library...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-red-500">{error}</p>
              <button onClick={fetchFaces} className="text-xs text-[#6C60FF] underline">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-gray-500 text-sm">
                {searchQuery ? `No people found matching "${searchQuery}"` : 'No people found in your library.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map((person) => (
                <PersonCardItem
                  key={person.id}
                  person={person}
                  selected={selectedForMerge.has(person.id)}
                  onToggleSelect={() => toggleMergeSelect(person.id)}
                  onClick={() => {
                    // If any face is selected for merge, clicking card toggles it instead of opening detail
                    if (selectedForMerge.size > 0) {
                      setSelectedForMerge(prev => {
                        const next = new Set(prev);
                        next.has(person.id) ? next.delete(person.id) : next.add(person.id);
                        return next;
                      });
                    } else {
                      setSelectedFaceIdx(person.rawIndex);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
