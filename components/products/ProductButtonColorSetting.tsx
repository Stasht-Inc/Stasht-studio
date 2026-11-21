// components/products/ProductButtonColorSetting.tsx — the account's "Button colour" on the Products page (Chris 21 Nov
// 2026, R2-2). Every product's buttons (buy button, "View on website", Enquire) on product pages, Storeels and newsletter
// cards use it, unless a product has its own (product editor → Visibility). "Use brand colour" (default) = the brand
// colour the web API works out (the brand cover's colour). Saved on the web API (PUT /products/button-color), so it
// follows the account everywhere; a colour change is saved once picking settles.
import { useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { BUTTON_SECONDARY } from '../newsletters/lib/ui';
import { productsAPI, type ProductButtonColorInfo } from '../../services/productsAPI';
import { announceProductsChanged } from '../../hooks/useProductsStatus';
import { clearProductMomentDetails } from '../storeel/useProductMomentDetails';
import { hexColor } from '../../utils/buttonColor';
import ProductButtonColorField from './ProductButtonColorField';

const SAVE_AFTER_MS = 500;

export default function ProductButtonColorSetting({ info, className = '' }: { info: ProductButtonColorInfo | null | undefined; className?: string }) {
  const [value, setValue] = useState(info?.setting ?? '');
  const [shown, setShown] = useState(info?.color ?? '#6C60FF');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const timer = useRef<number | null>(null);
  // Controlled, and Escape closes it ourselves too: Radix only lets the TOP-most layer take Escape, and another Radix
  // layer mounted later on the page (seen after a reload) can sit above it, so Escape did nothing and the panel stayed
  // over the product cards. The Custom picker's own Escape still comes first (it closes, the panel stays).
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[data-nl-color-picker]')) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const latest = useRef(0);
  // A newer answer from the web API (another tab, a reload) when nothing is waiting to be saved.
  useEffect(() => {
    if (timer.current !== null) return;
    setValue(info?.setting ?? '');
    setShown(info?.color ?? '#6C60FF');
  }, [info?.setting, info?.color]);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const brand = info?.brand ?? '#6C60FF';
  const save = (color: string) => {
    const ticket = ++latest.current;
    setSaving(true);
    void productsAPI.setButtonColor(hexColor(color)).then((res) => {
      if (ticket !== latest.current) return; // a newer pick is on its way
      setSaving(false);
      if (res.ok && res.data) {
        setError('');
        setShown(res.data.color);
        clearProductMomentDetails(); // the Storeel preview reads products' colours again
        announceProductsChanged(); // GET /products/status again: every page using the colour follows
      } else {
        setError(res.error || "The button colour couldn't be saved. Please try again.");
      }
    });
  };
  const change = (color: string) => {
    setValue(color);
    setShown(hexColor(color) ?? brand);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { timer.current = null; save(color); }, SAVE_AFTER_MS);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" data-testid="products-button-color" className={`${BUTTON_SECONDARY} whitespace-nowrap ${className}`}>
          <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: shown }} />
          Button colour
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-4 shadow-lg" data-testid="products-button-color-panel">
        <ProductButtonColorField idPrefix="account-button-color" value={value} brand={brand} onChange={change}
          hint="Used by every product's buttons, unless a product has its own." />
        {/* Chris's rule: the card's messages at its bottom. */}
        {saving && <p className="mt-3 text-xs text-gray-500" role="status">Saving…</p>}
        {error && <p className="mt-3 text-xs text-red-600" role="alert">{error}</p>}
      </PopoverContent>
    </Popover>
  );
}
