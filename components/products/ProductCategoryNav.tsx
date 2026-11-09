// components/products/ProductCategoryNav.tsx — the merged category list (website categories + the business's own),
// laid out like the Campaigns categories column (WebsiteCatalogNav rows).
import { useState, type FormEvent, type ReactElement } from 'react';
import { Folder, FolderOpen, Globe, MoreHorizontal, Plus } from 'lucide-react';
import { productsAPI, type ProductCategory } from '../../services/productsAPI';
import { WEBSITE_CATALOG_COLOR } from '../../utils/categoryColorManager';
import { BUTTON_SMALL, BUTTON_SMALL_PRIMARY, LINK_BUTTON, inputClass } from '../newsletters/lib/ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

export default function ProductCategoryNav({ categories, total, selectedId, canEdit, onSelect, onChanged }: {
  categories: ProductCategory[];
  total: number;
  selectedId: number | null;
  canEdit: boolean;
  onSelect(id: number | null): void;
  onChanged(): Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState<ProductCategory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>, done: () => void) => {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) { setError(r.fieldErrors?.name || r.error || 'That did not work. Please try again.'); return; }
    done();
    await onChanged();
  };
  const create = (e: FormEvent) => { e.preventDefault(); void act(() => productsAPI.createCategory(name.trim()), () => { setAdding(false); setName(''); }); };
  const rename = (e: FormEvent) => { e.preventDefault(); if (renaming) void act(() => productsAPI.renameCategory(renaming.id, renaming.name.trim()), () => setRenaming(null)); };

  const row = (key: string, label: string, count: number, active: boolean, onClick: () => void, extra?: ReactElement, website = false) => (
    <div key={key} className="group flex items-center gap-1">
      <button type="button" onClick={onClick}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg p-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] ${active ? 'bg-[#6C60FF]/10 font-medium text-[#6C60FF]' : 'text-gray-700 hover:bg-gray-50'}`}>
        {active ? <FolderOpen className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Folder className="h-4 w-4 shrink-0" aria-hidden="true" />}
        <span className="truncate">{label}</span>
        {website && <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: WEBSITE_CATALOG_COLOR }} aria-label="From your website" />}
        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{count}</span>
      </button>
      {extra}
    </div>
  );

  return (
    <nav aria-label="Product categories" className="space-y-1">
      <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Categories</p>
      {row('all', 'All products', total, selectedId === null, () => onSelect(null))}
      {categories.map((c) => (renaming?.id === c.id ? (
        <form key={c.id} onSubmit={rename} className="flex items-center gap-1 p-1">
          <input aria-label="Category name" autoFocus value={renaming.name} onChange={(e) => setRenaming({ id: c.id, name: e.target.value })} className={inputClass()} />
          <button type="submit" className={BUTTON_SMALL_PRIMARY} disabled={busy}>Save</button>
          <button type="button" className={BUTTON_SMALL} onClick={() => setRenaming(null)}>Cancel</button>
        </form>
      ) : row(String(c.id), c.name, c.product_count, selectedId === c.id, () => onSelect(c.id), canEdit && !c.read_only ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`${c.name} options`} className="rounded p-1 text-gray-500 hover:bg-gray-100"><MoreHorizontal className="h-4 w-4" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white border border-gray-200 shadow-lg rounded-md">
            <DropdownMenuItem onSelect={() => setRenaming({ id: c.id, name: c.name })}>Rename</DropdownMenuItem>
            {!c.from_website && <DropdownMenuItem onSelect={() => setDeleting(c)} className="text-red-600">Delete</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : undefined, c.from_website)))}
      {canEdit && (adding ? (
        <form onSubmit={create} className="flex items-center gap-1 p-1">
          <input aria-label="New category name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" className={inputClass()} />
          <button type="submit" className={BUTTON_SMALL_PRIMARY} disabled={busy || !name.trim()}>Add</button>
          <button type="button" className={BUTTON_SMALL} onClick={() => { setAdding(false); setName(''); }}>Cancel</button>
        </form>
      ) : (
        <button type="button" className={`${LINK_BUTTON} px-2 pt-2`} onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden="true" />New category</button>
      ))}
      {error && <p role="alert" className="px-2 pt-2 text-sm text-red-600">{error}</p>}
      <AlertDialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>The products stay; they are just no longer in this category.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => { const c = deleting; setDeleting(null); if (c) void act(() => productsAPI.deleteCategory(c.id), () => { if (selectedId === c.id) onSelect(null); }); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  );
}
