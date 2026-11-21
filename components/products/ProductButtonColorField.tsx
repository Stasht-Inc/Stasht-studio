// components/products/ProductButtonColorField.tsx — "Button colour" (Chris 21 Nov 2026, R2-2: "we need ability to color
// button … so it matches their brand. By default maybe it can use the color it chooses from the default background").
// "Use brand colour" (on = no colour of its own) and, when off, the same colour panel every Studio colour uses (the
// newsletter editor's preset swatches + Custom with a HEX field; also the 17 Nov category colour picker's swatches).
// Used by the product editor's Visibility card (one product) and the Products page's Button colour (the account).
import ColorSwatches from '../newsletters/ColorSwatches';
import { LABEL } from '../newsletters/lib/ui';
import { Switch } from '../ui/switch';
import { buttonColors, hexColor } from '../../utils/buttonColor';

export default function ProductButtonColorField({ idPrefix, value, brand, onChange, disabled = false, label = 'Button colour', brandLabel = 'Use brand colour', hint, previewText = 'Buy now' }: {
  idPrefix: string;
  /** The chosen colour; '' = the brand colour. */
  value: string;
  /** What "the brand colour" is right now (shown on its switch and as the button preview). */
  brand: string;
  onChange(color: string): void;
  disabled?: boolean;
  label?: string;
  brandLabel?: string;
  hint?: string;
  /** The words on the preview button. */
  previewText?: string;
}) {
  const own = hexColor(value);
  const useBrand = !own;
  const shown = buttonColors(own ?? brand);
  return (
    <div data-testid={`${idPrefix}-field`}>
      <p className={LABEL} id={`${idPrefix}-label`}>{label}</p>
      <label className="flex items-center gap-3 text-sm text-gray-800">
        <Switch checked={useBrand} disabled={disabled} aria-label={brandLabel} data-testid={`${idPrefix}-use-brand`}
          onCheckedChange={(on) => onChange(on ? '' : (hexColor(brand) ?? '#6C60FF'))} />
        {brandLabel}
        <span aria-hidden="true" className="inline-block h-4 w-4 flex-shrink-0 rounded-full border border-gray-200" style={{ backgroundColor: hexColor(brand) ?? '#6C60FF' }} />
      </label>
      {!useBrand && (
        <div className="mt-3">
          <ColorSwatches label="Colour" idPrefix={idPrefix} value={own ?? ''} onChange={(c) => { if (!disabled) onChange(hexColor(c) ?? c); }} />
        </div>
      )}
      {/* How the button looks: the product's buy button / "View on website" / Enquire take this colour. */}
      <span data-testid={`${idPrefix}-preview`} className="mt-3 inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: shown.background, color: shown.text }}>{previewText}</span>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
