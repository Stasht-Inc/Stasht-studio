// components/products/ProductCategoryNav.tsx — the merged category list (website categories + the business's own).
// Chris, 16 Nov: the same pattern as Campaigns' categories column (components/CategoryNav.tsx): a "Category Filter"
// heading, the "All Categories" Select and the outlined "+" that opens the shared New Category / Edit Category popover
// (CategoryNav's AddCategoryPopover), then category cards like CategoryNav's (folder, name, count pill; the pencil and
// the trash show on hover), and Campaigns' Delete Category dialog. Active rows are gray (Chris: never purple).
import { useState, type ReactElement } from 'react';
import { toast } from 'sonner';
import { Folder, FolderOpen, Globe, Pencil, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { productsAPI, type ProductCategory } from '../../services/productsAPI';
import { WEBSITE_CATALOG_COLOR } from '../../utils/categoryColorManager';
import { SHOPIFY_PRODUCT_COLOR, productCategoryColor } from '../../utils/products';
import { AddCategoryPopover } from '../CategoryNav';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import ProductSelect, { FILTER_TRIGGER } from './ProductSelect';

type Editing = { mode: 'create' } | { mode: 'edit'; id: number };
type Result = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };
const FAILED = 'That did not work. Please try again.';

export default function ProductCategoryNav({ categories, total, selectedId, canEdit, onSelect, onChanged }: {
  categories: ProductCategory[];
  total: number;
  selectedId: number | null;
  canEdit: boolean;
  onSelect(id: number | null): void;
  onChanged(): Promise<void>;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<ProductCategory | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);

  const close = () => { setEditing(null); setName(''); setFormError(null); };
  const openCreate = () => { setNavError(null); setFormError(null); setName(''); setEditing({ mode: 'create' }); };
  const openEdit = (c: ProductCategory) => { setNavError(null); setFormError(null); setName(c.name); setEditing({ mode: 'edit', id: c.id }); };
  const others = editing?.mode === 'edit' ? categories.filter((c) => c.id !== editing.id) : categories;

  const save = async () => {
    const trimmed = name.trim();
    if (!editing || busy || !trimmed || others.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    const was = editing.mode === 'edit' ? categories.find((c) => c.id === editing.id)?.name : undefined;
    if (editing.mode === 'edit' && was === trimmed) { close(); return; }
    setBusy(true);
    setFormError(null);
    const r: Result = editing.mode === 'edit' ? await productsAPI.renameCategory(editing.id, trimmed) : await productsAPI.createCategory(trimmed);
    setBusy(false);
    if (!r.ok) { setFormError(r.fieldErrors?.name || r.error || FAILED); return; } // under the field (Chris)
    toast.success(editing.mode === 'edit' ? `Category renamed to "${trimmed}"` : `Category "${trimmed}" created`);
    close();
    await onChanged(); // categories + the list, so cards show the new name straight away
  };

  const remove = async () => {
    const c = deleting;
    if (!c || deleteBusy) return;
    setDeleteBusy(true);
    setNavError(null);
    const r: Result = await productsAPI.deleteCategory(c.id);
    setDeleteBusy(false);
    setDeleting(null);
    if (!r.ok) { setNavError(r.error || FAILED); return; }
    if (selectedId === c.id) onSelect(null);
    toast.success(`Category "${c.name}" deleted`);
    await onChanged();
  };

  // CategoryNav's category card: #F5F5F5, gray when active or hovered; the folder opens in the category's colour.
  const row = (key: string, label: string, count: number, active: boolean, onClick: () => void, opts: { color?: string; website?: boolean; shopify?: boolean; edit?: () => void; remove?: () => void } = {}): ReactElement => (
    <div key={key} className={`group flex w-full items-center rounded-lg transition-colors ${active ? 'bg-gray-200' : 'bg-[#F5F5F5] hover:bg-gray-200'}`}>
      <button type="button" onClick={onClick} aria-current={active || undefined}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-3 text-left text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400">
        {active ? <FolderOpen className="h-4 w-4 shrink-0" style={{ color: opts.color || '#374151' }} aria-hidden="true" /> : <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span className={`truncate ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
        {opts.shopify
          ? <ShoppingBag className="h-3.5 w-3.5 shrink-0" style={{ color: SHOPIFY_PRODUCT_COLOR }} aria-label="From your Shopify store" />
          : opts.website && <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: WEBSITE_CATALOG_COLOR }} aria-label="From your website" />}
      </button>
      {opts.edit && (
        <button type="button" onClick={opts.edit} title={`Edit ${label}`} aria-label={`Rename ${label}`}
          className="shrink-0 rounded p-1 transition-all hover:bg-gray-300 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-gray-400 md:opacity-0 md:group-hover:opacity-100">
          <Pencil className="h-3 w-3 text-gray-500" aria-hidden="true" />
        </button>
      )}
      <div className="relative mr-2 flex shrink-0 items-center gap-1 pl-1">
        <span className={`inline-block rounded-full px-2 py-1 text-xs text-black transition-opacity ${active ? 'bg-gray-300' : ''} ${opts.remove ? 'md:group-hover:opacity-0' : ''}`}>{count}</span>
        {opts.remove && (
          // Campaigns: the trash takes the count's place on hover. On a phone (no hover) it sits next to the count.
          <button type="button" onClick={opts.remove} title="Delete category" aria-label={`Delete ${label}`}
            className="flex items-center justify-center rounded-full p-1 text-red-500 transition-all hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-300 md:absolute md:inset-0 md:opacity-0 md:group-hover:opacity-100">
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );

  const editTitle = editing?.mode === 'edit';
  return (
    <nav aria-label="Product categories" className="space-y-3">
      <div>
        <span className="mb-3 block text-sm font-medium text-gray-900">Category Filter</span>
        <div className="flex items-center gap-2">
          <ProductSelect label="Category filter" value={selectedId === null ? 'all' : String(selectedId)} className={`h-9 flex-1 text-sm ${FILTER_TRIGGER}`}
            options={[{ value: 'all', label: 'All Categories' }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]}
            onChange={(v) => onSelect(v === 'all' ? null : Number(v))} />
          {canEdit && (
            <Popover open={editing !== null} onOpenChange={(o) => { if (!o) close(); }}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 flex-shrink-0 border-[#6C60FF] px-3 text-sm text-[#6C60FF] hover:bg-[#6C60FF]/10" title="Add new category" aria-label="New category"
                  onClick={openCreate}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden rounded-xl border-0 p-0 shadow-lg" align="end">
                <AddCategoryPopover value={name} onChange={(v) => { setName(v); setFormError(null); }} onSave={() => void save()} onCancel={close}
                  onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } }}
                  existingCategories={others} title={editTitle ? 'Edit Category' : 'New Category'} buttonText={editTitle ? 'Edit' : 'Create'}
                  subtitle={editTitle ? 'Rename your category' : 'Create a category to organize products'} error={formError} busy={busy} />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {row('all', 'All products', total, selectedId === null, () => onSelect(null))}
        {categories.map((c) => {
          const own = canEdit && !c.read_only;
          return row(String(c.id), c.name, c.product_count, selectedId === c.id, () => onSelect(c.id), {
            color: productCategoryColor(c.id, c.from_website, Boolean(c.from_shopify)),
            website: c.from_website,
            shopify: Boolean(c.from_shopify),
            edit: own ? () => openEdit(c) : undefined,
            remove: own && !c.from_website ? () => { setNavError(null); setDeleting(c); } : undefined,
          });
        })}
      </div>
      {/* Chris: messages at the bottom of the card. */}
      {navError && <p role="alert" className="px-1 text-sm text-red-600">{navError}</p>}
      <AlertDialog open={deleting !== null} onOpenChange={(o) => { if (!o && !deleteBusy) setDeleting(null); }}>
        {/* Campaigns' Delete Category dialog (CategoryNav), with what happens to the products. */}
        <AlertDialogContent className="border-0 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category "{deleting?.name}"? Its products stay; they are just no longer in this category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleteBusy} className="bg-red-600 text-white hover:bg-red-700" onClick={(e) => { e.preventDefault(); void remove(); }}>
              {deleteBusy ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  );
}
