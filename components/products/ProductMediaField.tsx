// components/products/ProductMediaField.tsx — photos (drag to reorder, first is main) and one optional video.
// Media has its own routes (upload / order / remove); every answer is the product's new detail. The size, type and
// count limits are the API's (config/products.php) and its messages are shown as they come.
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { productsAPI, type ProductDetail, type ProductMediaItem } from '../../services/productsAPI';
import { moveItem } from '../../utils/products';
import { BUTTON_SECONDARY } from '../newsletters/lib/ui';

export default function ProductMediaField({ productId, media, disabled, onChange }: {
  productId: number | null; media: ProductMediaItem[]; disabled: boolean; onChange(detail: ProductDetail): void;
}) {
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  if (!productId) return <p className="text-sm text-gray-500">Save the product to add photos and a video.</p>;

  const upload = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (input.current) input.current.value = '';
    if (!list.length) return;
    setErrors([]);
    setUploading(list.length);
    const failed: string[] = [];
    for (const file of list) {
      const r = await productsAPI.uploadMedia(productId, file);
      if (r.ok && r.data) onChange(r.data); else failed.push(`${file.name}: ${r.error}`);
      setUploading((n) => n - 1);
    }
    setErrors(failed);
  };
  const reorder = async (from: number, to: number) => {
    if (busy) return;
    setBusy(true);
    setErrors([]);
    const r = await productsAPI.orderMedia(productId, moveItem(media, from, to).map((m) => m.id));
    setBusy(false);
    if (r.ok && r.data) onChange(r.data); else setErrors([r.error || 'The new order could not be saved. Please try again.']);
  };
  const remove = async (id: number) => {
    if (busy) return;
    setBusy(true);
    setErrors([]);
    const r = await productsAPI.removeMedia(productId, id);
    setBusy(false);
    if (r.ok && r.data) onChange(r.data); else setErrors([r.error || 'That could not be removed. Please try again.']);
  };
  let photoNumber = 0;

  return (
    <div>
      {media.length === 0 && disabled && <p className="text-sm text-gray-500">No photos.</p>}
      {media.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {media.map((m, i) => {
            const label = m.type === 'video' ? 'Video' : `Photo ${++photoNumber}`;
            return (
              <li key={m.id} draggable={!disabled && !busy} onDragStart={() => setDragFrom(i)} onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragFrom !== null && dragFrom !== i) void reorder(dragFrom, i); setDragFrom(null); }}
                className={`group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 ${disabled ? '' : 'cursor-grab'}`}>
                {m.type === 'video'
                  ? <video src={m.url} className="h-full w-full object-cover" muted playsInline controls={false} aria-label="Product video" />
                  : <img src={m.url} alt={label} className="h-full w-full object-cover" />}
                {i === 0 && m.type === 'photo' && <span className="absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-xs font-medium text-gray-800">Main</span>}
                {m.type === 'video' && <span className="absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-xs font-medium text-gray-800">Video</span>}
                {!disabled && (
                  <div className="absolute inset-x-1 bottom-1 flex justify-between md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    <span className="flex gap-1">
                      <button type="button" aria-label={`Move ${label} earlier`} disabled={i === 0 || busy} onClick={() => void reorder(i, i - 1)} className="rounded bg-white/90 p-1 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Move ${label} later`} disabled={i === media.length - 1 || busy} onClick={() => void reorder(i, i + 1)} className="rounded bg-white/90 p-1 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                    </span>
                    <button type="button" aria-label={`Remove ${label}`} disabled={busy} onClick={() => void remove(m.id)} className="rounded bg-white/90 p-1 text-red-600 disabled:opacity-40"><X className="h-4 w-4" /></button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!disabled && (
        <>
          <input ref={input} type="file" multiple aria-label="Choose photos or a video" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm" className="hidden" onChange={(e) => void upload(e.target.files)} />
          <button type="button" className={`${BUTTON_SECONDARY} mt-3`} disabled={uploading > 0} onClick={() => input.current?.click()}>
            {uploading > 0 ? `Uploading ${uploading}…` : 'Add photos or a video'}
          </button>
          <p className="mt-1 text-xs text-gray-500">Drag to reorder. The first photo is the main photo. Up to 20 photos and one video.</p>
        </>
      )}
      {errors.length > 0 && <ul role="alert" className="mt-3 space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errors.map((e, i) => <li key={`${i}-${e}`}>{e}</li>)}</ul>}
    </div>
  );
}
