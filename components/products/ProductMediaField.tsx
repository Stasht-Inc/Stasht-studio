// components/products/ProductMediaField.tsx — photos (drag to reorder, first is main) and one optional video.
// A saved product: media has its own routes (upload / order / remove); every answer is the product's new detail. The
// size, type and count limits are the API's (config/products.php) and its messages are shown as they come.
// C4 (Chris, 16 Nov): a NEW product gets the same picker before its first save. The picked files stay on the device
// (`pending`, previewed from object URLs; same grid, Main badge, reorder and remove) and the editor uploads them right
// after the product is created. Messages sit at the bottom of the Media card.
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { productsAPI, type ProductDetail, type ProductMediaItem } from '../../services/productsAPI';
import { acceptPickedMedia, moveItem } from '../../utils/products';
import { HEIC_CONVERT_FAILED, prepareImageForUpload } from '../../utils/uploadFiles';
import { BUTTON_SECONDARY } from '../newsletters/lib/ui';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

/** A photo or video picked on a new product, not uploaded yet. `url` is an object URL (the editor revokes it). */
export interface PendingMedia { key: string; file: File; url: string; type: 'photo' | 'video' }

// HEIC/HEIF (iPhone / Mac Photos) are offered too and go up as JPEG (Chris 19 Nov 2026).
const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif,video/mp4,video/quicktime,.mov,video/webm';
let pendingSeq = 0;

/** onChange: every answer (the product's new detail). onSettled: once per finished action (an upload batch, a reorder,
 *  a removal) that changed something, e.g. to refresh the grid. pending / onPendingChange: a new product's picks.
 *  notes: lines the editor adds at the bottom (the files that failed to upload after the first save). */
export default function ProductMediaField({ productId, media, disabled, onChange, onSettled, pending = [], onPendingChange, notes = [], uploadingPending = 0 }: {
  productId: number | null; media: ProductMediaItem[]; disabled: boolean; onChange(detail: ProductDetail): void; onSettled?(): void;
  pending?: PendingMedia[]; onPendingChange?(next: PendingMedia[]): void; notes?: string[]; uploadingPending?: number;
}) {
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [removing, setRemoving] = useState<{ id: number; label: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const local = !productId; // a new product: picks wait for the first save
  if (local && !onPendingChange) return <p className="text-sm text-gray-500">Save the product to add photos and a video.</p>;

  const upload = async (files: FileList | null) => {
    const picked = files ? Array.from(files) : [];
    if (input.current) input.current.value = '';
    if (!picked.length) return;
    setErrors([]);
    const list: File[] = [];
    const unreadable: string[] = [];
    for (const file of picked) {
      try { list.push((await prepareImageForUpload(file)) as File); } catch { unreadable.push(`${file.name}: ${HEIC_CONVERT_FAILED}`); }
    }
    if (!list.length) { setErrors(unreadable); return; }
    if (local) {
      const { accepted, errors: refused } = acceptPickedMedia({ photos: pending.filter((m) => m.type === 'photo').length, videos: pending.filter((m) => m.type === 'video').length }, list);
      if (accepted.length) onPendingChange?.([...pending, ...accepted.map(({ file, type }) => ({ key: `pending-${++pendingSeq}`, file, type, url: URL.createObjectURL(file) }))]);
      setErrors([...unreadable, ...refused]);
      return;
    }
    setUploading(list.length);
    const failed: string[] = [];
    let saved = 0;
    for (const file of list) {
      const r = await productsAPI.uploadMedia(productId, file);
      if (r.ok && r.data) { onChange(r.data); saved += 1; } else failed.push(`${file.name}: ${r.error || 'The file could not be uploaded. Please try again.'}`);
      setUploading((n) => n - 1);
    }
    setErrors([...unreadable, ...failed]);
    if (saved) onSettled?.();
  };
  const locked = busy || uploading > 0 || uploadingPending > 0; // one change at a time: no reorder or removal while files upload
  const reorder = async (from: number, to: number) => {
    if (locked) return;
    setErrors([]);
    if (local) { onPendingChange?.(moveItem(pending, from, to)); return; }
    setBusy(true);
    const r = await productsAPI.orderMedia(productId, moveItem(media, from, to).map((m) => m.id));
    setBusy(false);
    if (r.ok && r.data) { onChange(r.data); onSettled?.(); } else setErrors([r.error || 'The new order could not be saved. Please try again.']);
  };
  const remove = async (id: number) => {
    if (locked) return;
    setBusy(true);
    setErrors([]);
    const r = await productsAPI.removeMedia(productId as number, id);
    setBusy(false);
    if (r.ok && r.data) { onChange(r.data); onSettled?.(); } else setErrors([r.error || 'That could not be removed. Please try again.']);
  };
  // A pick that isn't uploaded yet goes straight away (nothing is lost: it is still on the device).
  const removePending = (key: string) => {
    if (locked) return;
    const gone = pending.find((m) => m.key === key);
    if (gone) URL.revokeObjectURL(gone.url);
    setErrors([]);
    onPendingChange?.(pending.filter((m) => m.key !== key));
  };
  // A saved item (id) asks first; a pick (no id) goes straight away.
  const items: Array<{ key: string; url: string; type: 'photo' | 'video'; id: number | null }> = local
    ? pending.map((m) => ({ key: m.key, url: m.url, type: m.type, id: null }))
    : media.map((m) => ({ key: String(m.id), url: m.url, type: m.type, id: m.id }));
  const shownErrors = [...notes, ...errors];
  let photoNumber = 0;

  return (
    <div>
      {items.length === 0 && disabled && <p className="text-sm text-gray-500">No photos.</p>}
      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((m, i) => {
            const label = m.type === 'video' ? 'Video' : `Photo ${++photoNumber}`;
            const askRemove = () => (m.id === null ? removePending(m.key) : setRemoving({ id: m.id, label }));
            return (
              <li key={m.key} draggable={!disabled && !locked} onDragStart={() => setDragFrom(i)} onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragFrom !== null && dragFrom !== i) void reorder(dragFrom, i); setDragFrom(null); }}
                data-pending={local || undefined}
                className={`group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 ${disabled ? '' : 'cursor-grab'}`}>
                {m.type === 'video'
                  ? <video src={m.url} className="h-full w-full object-cover" muted playsInline controls={false} aria-label="Product video" />
                  : <img src={m.url} alt={label} className="h-full w-full object-cover" />}
                {i === 0 && m.type === 'photo' && <span className="absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-xs font-medium text-gray-800">Main</span>}
                {m.type === 'video' && <span className="absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-xs font-medium text-gray-800">Video</span>}
                {!disabled && (
                  <div className="absolute inset-x-1 bottom-1 flex justify-between md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    <span className="flex gap-1">
                      <button type="button" aria-label={`Move ${label} earlier`} disabled={i === 0 || locked} onClick={() => void reorder(i, i - 1)} className="rounded bg-white/90 p-1 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Move ${label} later`} disabled={i === items.length - 1 || locked} onClick={() => void reorder(i, i + 1)} className="rounded bg-white/90 p-1 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                    </span>
                    <button type="button" aria-label={`Remove ${label}`} disabled={locked} onClick={askRemove} className="rounded bg-white/90 p-1 text-red-600 disabled:opacity-40"><X className="h-4 w-4" /></button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!disabled && (
        <>
          <input ref={input} type="file" multiple aria-label="Choose photos or a video" accept={ACCEPT} className="hidden" onChange={(e) => void upload(e.target.files)} />
          <button type="button" className={`${BUTTON_SECONDARY} mt-3`} disabled={uploading > 0 || uploadingPending > 0} onClick={() => input.current?.click()}>
            {uploading > 0 ? `Uploading ${uploading}…` : uploadingPending > 0 ? `Uploading ${uploadingPending}…` : 'Add photos or a video'}
          </button>
          <p className="mt-1 text-xs text-gray-500">
            Drag to reorder. The first photo is the main photo. Up to 20 photos and one video.{local && pending.length > 0 ? ' They upload when you save.' : ''}
          </p>
        </>
      )}
      <AlertDialog open={removing !== null} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.label === 'Video' ? 'the video' : removing?.label.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>It is removed from this product straight away.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => { const r = removing; setRemoving(null); if (r) void remove(r.id); }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {shownErrors.length > 0 && <ul role="alert" className="mt-3 space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{shownErrors.map((e, i) => <li key={`${i}-${e}`}>{e}</li>)}</ul>}
    </div>
  );
}
