// components/products/ProductBulkBar.tsx — spec bulk actions: change status, change category, delete (manual only).
// Share is M4 (Send Message / Storeel) and is not offered yet.
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { productsAPI, type ProductCategory, type ProductStatus, type ProductSummary } from '../../services/productsAPI';
import { BUTTON_SMALL, LINK_BUTTON, inputClass } from '../newsletters/lib/ui';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

export default function ProductBulkBar({ selected, categories, onDone, onClear }: {
  selected: ProductSummary[];
  categories: ProductCategory[];
  onDone(): Promise<void>;
  onClear(): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const ids = selected.map((p) => p.id);
  const allManual = selected.length > 0 && selected.every((p) => p.origin === 'manual');

  const apply = async (body: { action: 'status' | 'category' | 'delete'; status?: ProductStatus; category_id?: number; mode?: 'add' }) => {
    setBusy(true);
    setError(null);
    const r = await productsAPI.bulk({ ids, ...body });
    setBusy(false);
    if (!r.ok) { setError(r.error || 'That did not work. Please try again.'); return; }
    await onDone();
  };

  return (
    <div data-testid="product-bulk-bar" className="sticky top-20 z-20 mb-4 rounded-xl border border-[#6C60FF]/30 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{selected.length} selected</span>
        <select aria-label="Change status" value="" disabled={busy} className={`${inputClass()} sm:w-auto`}
          onChange={(e) => { if (e.target.value) void apply({ action: 'status', status: e.target.value as ProductStatus }); }}>
          <option value="">Change status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        {categories.length > 0 && (
          <select aria-label="Add to category" value="" disabled={busy} className={`${inputClass()} sm:w-auto`}
            onChange={(e) => { if (e.target.value) void apply({ action: 'category', category_id: Number(e.target.value), mode: 'add' }); }}>
            <option value="">Add to category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <button type="button" className={BUTTON_SMALL} disabled={!allManual || busy} onClick={() => setConfirm(true)}
          title={allManual ? undefined : "Products from your website can't be deleted. Archive them instead."}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />Delete
        </button>
        <button type="button" className={`${LINK_BUTTON} ml-auto`} onClick={onClear}>Clear selection</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.length} {selected.length === 1 ? 'product' : 'products'}?</AlertDialogTitle>
            <AlertDialogDescription>Campaigns that already show them keep their moments. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => void apply({ action: 'delete' })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
