// components/products/ProductBulkBar.tsx — spec bulk actions: change status, change category, delete (manual only).
// Share is M4 (Send Message / Storeel) and is not offered yet.
// Messages sit at the bottom of the bar (Chris): the website-delete hint, the server's result, then any error. The page
// keeps the bar up after an action while `notice` is set, even when nothing stays selected.
import { useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { productsAPI, type ProductCategory, type ProductStatus, type ProductSummary } from '../../services/productsAPI';
import { bulkResultMessage, WEBSITE_DELETE_HINT } from '../../utils/products';
import { BUTTON_SMALL, LINK_BUTTON, inputClass } from '../newsletters/lib/ui';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

export interface BulkOutcome {
  message: string; // e.g. "3 updated, 1 skipped (…)."
  keepIds: number[]; // what the API skipped: stays selected
  ticket: number; // the page's list the action ran on (the `ticket` prop when it started)
}

type Pending = { action: 'delete' } | { action: 'status'; status: ProductStatus } | { action: 'category'; category_id: number; name: string };
const STATUS_LABEL: Record<string, string> = { active: 'Active', draft: 'Draft', archived: 'Archived' };

export default function ProductBulkBar({ selected, categories, notice, ticket, onDone, onClear }: {
  selected: ProductSummary[];
  ticket: number;
  categories: ProductCategory[];
  notice: string | null;
  onDone(outcome: BulkOutcome): Promise<void>;
  onClear(): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Final review I5: every bulk action asks first, in the same dialog as Delete (a single keypress on a closed select
  // fires its change on Windows / Linux).
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const hintId = useId();
  const ids = selected.map((p) => p.id);
  const hasWebsite = selected.some((p) => p.origin !== 'manual');
  const canDelete = selected.length > 0 && !hasWebsite && !busy;
  const count = `${selected.length} ${selected.length === 1 ? 'product' : 'products'}`;

  const apply = async (body: { action: 'status' | 'category' | 'delete'; status?: ProductStatus; category_id?: number; mode?: 'add' }) => {
    setBusy(true);
    setError(null);
    const ranOn = ticket;
    const websiteIds = selected.filter((p) => p.origin !== 'manual').map((p) => p.id);
    const r = await productsAPI.bulk({ ids, ...body });
    setBusy(false);
    if (!r.ok || !r.data) { setError(r.error || 'That did not work. Please try again.'); return; }
    await onDone({ message: bulkResultMessage(body.action, r.data, websiteIds), keepIds: r.data.skipped_ids ?? [], ticket: ranOn });
  };

  return (
    <div data-testid="product-bulk-bar" className="sticky top-20 z-20 mb-4 rounded-xl border border-[#6C60FF]/30 bg-white p-3 shadow-sm">
      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{selected.length} selected</span>
          <select aria-label="Change status" value="" disabled={busy} className={`${inputClass()} sm:w-auto`}
            onChange={(e) => { if (e.target.value) setConfirm({ action: 'status', status: e.target.value as ProductStatus }); }}>
            <option value="">Change status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          {categories.length > 0 && (
            <select aria-label="Add to category" value="" disabled={busy} className={`${inputClass()} sm:w-auto`}
              onChange={(e) => {
                const c = categories.find((x) => String(x.id) === e.target.value);
                if (c) setConfirm({ action: 'category', category_id: c.id, name: c.name });
              }}>
              <option value="">Add to category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {/* aria-disabled (not disabled) so it stays focusable and screen readers read the hint below. */}
          <button type="button" className={`${BUTTON_SMALL} aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
            aria-disabled={!canDelete} aria-describedby={hasWebsite ? hintId : undefined}
            onClick={() => { if (canDelete) setConfirm({ action: 'delete' }); }}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />Delete
          </button>
          <button type="button" className={`${LINK_BUTTON} ml-auto`} onClick={onClear}>Clear selection</button>
        </div>
      ) : (
        // Nothing left selected: just the result, with a way to put the bar away.
        <div className="flex items-center justify-between gap-2">
          <p role="status" className="text-sm text-gray-800">{notice}</p>
          <button type="button" className={LINK_BUTTON} onClick={onClear}>Dismiss</button>
        </div>
      )}
      {hasWebsite && <p id={hintId} className="mt-2 text-xs text-gray-600">{WEBSITE_DELETE_HINT}</p>}
      {notice && selected.length > 0 && <p role="status" className="mt-2 text-sm text-gray-800">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        {/* Only Delete has a description; the others say it all in the title. */}
        <AlertDialogContent className="bg-white" {...(confirm?.action === 'delete' ? {} : { 'aria-describedby': undefined })}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === 'status' ? `Set ${count} to ${STATUS_LABEL[confirm.status] ?? confirm.status}?`
                : confirm?.action === 'category' ? `Add ${count} to ${confirm.name}?`
                  : `Delete ${count}?`}
            </AlertDialogTitle>
            {confirm?.action === 'delete' && <AlertDialogDescription>Campaigns that already show them keep their moments. This can't be undone.</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {confirm?.action === 'delete' ? (
              <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => void apply({ action: 'delete' })}>Delete</AlertDialogAction>
            ) : (
              <AlertDialogAction className="bg-[#6C60FF] text-white hover:bg-[#5B50E6]" onClick={() => {
                if (confirm?.action === 'status') void apply({ action: 'status', status: confirm.status });
                else if (confirm?.action === 'category') void apply({ action: 'category', category_id: confirm.category_id, mode: 'add' });
              }}>Confirm</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
