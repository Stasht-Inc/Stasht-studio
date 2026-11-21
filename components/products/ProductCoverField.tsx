// components/products/ProductCoverField.tsx — "Cover photo (optional) or Intro Video (optional)" for products, the same
// look as Create Campaign's step 1 (CreateMemory.tsx). Chris 21 Nov 2026: products need an Intro Video.
// P1 (Chris 21 Nov 2026): saved. The cover is the SAME value the product page's Edit Cover changes (20 Nov, point 16):
// the product's first media item — a photo is its cover photo, a video its intro video (the page plays it as a campaign
// plays its intro video). Picking uploads to the product's media (the Media card's own route and limits) and puts the
// pick first; one replaces the other as the cover, as on a campaign. An intro video replaces the product's one video.
// Remove = the page's Remove cover (I10): the brand shows, every photo / video stays in Media. A NEW product holds the
// pick first among its Media picks (they upload right after the first save, in order); Remove drops a pick made here.
import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Video, X } from 'lucide-react';
import { productsAPI, type ProductDetail, type ProductMediaItem } from '../../services/productsAPI';
import { acceptPickedMedia, editorCoverOf, mediaOrderWithFirst, pendingWithCover, videoToReplace, type EditorCoverKind } from '../../utils/products';
import { HEIC_CONVERT_FAILED, prepareImageForUpload, UploadFileError } from '../../utils/uploadFiles';
import type { PendingMedia } from './ProductMediaField';

let coverSeq = 0;

export default function ProductCoverField({
  disabled = false, productId, media, coverRemoved, onChange, onSettled, pending, onPendingChange, pendingRemoved, onPendingRemovedChange, locked = false,
}: {
  disabled?: boolean;
  /** The saved product (null: a new product, the pick waits for the first save). */
  productId: number | null;
  media: ProductMediaItem[];
  coverRemoved: boolean;
  /** Every answer: the product's new detail (the editor redraws Media from it). */
  onChange(detail: ProductDetail): void;
  /** Once per finished change, e.g. to refresh the Products grid. */
  onSettled?(): void;
  pending: PendingMedia[];
  onPendingChange(next: PendingMedia[]): void;
  /** A new product: Remove was pressed (the brand shows once it is saved). */
  pendingRemoved: boolean;
  onPendingRemovedChange(removed: boolean): void;
  /** Media is uploading elsewhere (the editor's first save): no change here meanwhile. */
  locked?: boolean;
}) {
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ kind: EditorCoverKind; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({}); // url → the picked file's name (this visit)
  const local = productId === null;

  const first = pending[0];
  const cover = local
    ? (!pendingRemoved && first ? { kind: first.type, url: first.url, id: null, name: first.file.name } : null)
    : (() => { const c = editorCoverOf(media, coverRemoved); return c ? { ...c, name: names[c.url] } : null; })();

  const pick = async (kind: EditorCoverKind, picked: File | null | undefined) => {
    if (!picked || busy) return;
    setError(null);
    let file: File;
    try {
      file = (await prepareImageForUpload(picked)) as File; // HEIC → JPEG; a Mac Photos pick read into memory
    } catch (e) {
      setError(e instanceof UploadFileError ? e.message : HEIC_CONVERT_FAILED);
      return;
    }
    if (local) {
      const keep = kind === 'video' ? pending.filter((m) => m.type !== 'video') : pending;
      const { accepted, errors } = acceptPickedMedia({ photos: keep.filter((m) => m.type === 'photo').length, videos: keep.filter((m) => m.type === 'video').length }, [file]);
      const got = accepted[0];
      if (!got || got.type !== kind) { setError(errors[0]?.replace(/^[^:]+:\s*/, '') || (kind === 'photo' ? 'Please choose a photo.' : 'Please choose a video.')); return; }
      const gone = pending.filter((m) => kind === 'video' && m.type === 'video');
      gone.forEach((m) => URL.revokeObjectURL(m.url));
      onPendingChange(pendingWithCover(pending, { key: `cover-${++coverSeq}`, file, type: kind, url: URL.createObjectURL(file) }));
      onPendingRemovedChange(false);
      return;
    }
    setBusy({ kind, name: file.name });
    try {
      let current = media;
      // A product has one video: the new intro video replaces it.
      const oldVideo = kind === 'video' ? videoToReplace(current) : null;
      if (oldVideo !== null) {
        const r = await productsAPI.removeMedia(productId, oldVideo);
        if (!r.ok || !r.data) { setError(r.error || 'The intro video could not be changed. Please try again.'); return; }
        onChange(r.data);
        current = r.data.media;
      }
      const before = new Set(current.map((m) => m.id));
      const up = await productsAPI.uploadMedia(productId, file);
      if (!up.ok || !up.data) { setError(up.error || `The ${kind === 'photo' ? 'cover photo' : 'intro video'} could not be uploaded. Please try again.`); if (oldVideo !== null) onSettled?.(); return; }
      let detail = up.data;
      const added = detail.media.find((m) => !before.has(m.id));
      if (added) {
        setNames((n) => ({ ...n, [added.url]: file.name }));
        const order = mediaOrderWithFirst(detail.media, added.id);
        const firstNow = [...detail.media].sort((a, b) => a.sort_order - b.sort_order)[0]?.id;
        // A new order also brings the cover back after a Remove cover (the web API's restoreCover).
        if (order[0] !== firstNow || detail.cover_removed) {
          const r = await productsAPI.orderMedia(productId, order);
          if (!r.ok || !r.data) { onChange(detail); onSettled?.(); setError(r.error || 'The file was added to Media, but it could not be made the cover. Drag it first in Media.'); return; }
          detail = r.data;
        }
      }
      onChange(detail);
      onSettled?.();
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setError(null);
    if (local) {
      // A pick made here is only on the device: Remove drops it. A Media pick shown as the cover stays in Media; the
      // brand shows once the product is saved (as Remove cover does).
      if (first?.key.startsWith('cover-')) { URL.revokeObjectURL(first.url); onPendingChange(pending.slice(1)); }
      else onPendingRemovedChange(true);
      return;
    }
    setBusy({ kind: cover?.kind || 'photo', name: '' });
    const r = await productsAPI.removeCover(productId);
    setBusy(null);
    if (!r.ok || !r.data) { setError(r.error || 'The cover could not be removed. Please try again.'); return; }
    onChange(r.data);
    onSettled?.();
  };

  const off = disabled || locked || Boolean(busy);
  return (
    <div data-testid="product-cover-field">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif" className="hidden" data-testid="product-cover-photo-input"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void pick('photo', f); }} />
        <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/webm,.mov,.mp4,.m4v,.webm" className="hidden" data-testid="product-intro-video-input"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void pick('video', f); }} />
        {(['photo', 'video'] as const).map((kind, i) => {
          const label = kind === 'photo' ? 'Cover photo' : 'Intro Video';
          const uploading = busy?.kind === kind && busy.name !== '';
          const chosen = !uploading && cover?.kind === kind;
          return (
            <React.Fragment key={kind}>
              {i === 1 && <span className="flex h-12 md:h-10 items-center text-sm text-gray-400" aria-hidden="true">or</span>}
              <div className="min-w-0">
                <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                  {kind === 'photo' ? <ImageIcon className="w-4 h-4 text-black flex-shrink-0" /> : <Video className="w-4 h-4 text-black flex-shrink-0" />}
                  <span className="truncate">{label}</span>
                  <span className="hidden md:inline text-gray-400 font-normal">(optional)</span>
                </label>
                {uploading ? (
                  <div className="flex h-12 md:h-10 items-center gap-2 px-3 border border-gray-200 rounded-lg bg-gray-50" role="status" data-testid={`product-cover-uploading-${kind}`}>
                    <span className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-[#6C60FF] border-t-transparent" aria-hidden="true" />
                    <span className="min-w-0 truncate text-sm text-gray-700">{busy?.name}</span>
                    <span className="flex-shrink-0 text-xs text-[#6C60FF]">Uploading...</span>
                  </div>
                ) : chosen && cover ? (
                  <div className="flex h-12 md:h-10 items-center justify-between gap-2 px-3 border border-gray-200 rounded-lg bg-gray-50" data-testid={`product-cover-choice-${kind}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {kind === 'photo'
                        ? <img src={cover.url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" data-testid="product-cover-thumb" />
                        : <Video className="w-4 h-4 text-[#6C60FF] flex-shrink-0" />}
                      <span className="text-sm text-gray-700 truncate">{cover.name || label}</span>
                    </div>
                    <button type="button" aria-label={`Remove ${label.toLowerCase()}`} onClick={() => void remove()} disabled={off}
                      className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button type="button" disabled={off}
                    onClick={() => (kind === 'photo' ? photoInput : videoInput).current?.click()}
                    className="w-full h-12 md:h-10 px-2 border border-gray-300 rounded-lg text-base md:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors truncate disabled:opacity-50">
                    {kind === 'photo' ? 'Add Cover Photo' : 'Add Intro Video'}
                  </button>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-red-600" data-testid="product-cover-error">{error}</p>}
    </div>
  );
}
