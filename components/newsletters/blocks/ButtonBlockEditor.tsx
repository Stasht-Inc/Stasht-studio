import type { ButtonBlockData } from '../../../services/newslettersAPI';
import ColorSwatches from '../ColorSwatches';
import { contrastInk, safeHexColor } from '../lib/colors';
import { LIMITS } from '../lib/rules';
import { toHttpsUrl } from '../lib/urls';
import { LABEL, PURPLE, inputClass } from '../lib/ui';
import type { BlockEditorProps } from './types';
import { useUrlField } from './useUrlField';

export default function ButtonBlockEditor({ blockId, data, selected, readOnly, onChange }: BlockEditorProps<ButtonBlockData>) {
  const url = useUrlField(data.url ?? '', (next) => onChange({ url: next }), toHttpsUrl);
  const color = safeHexColor(data.color, PURPLE);

  return (
    <div>
      {/* As in the email (blocks/button.blade.php): a centred button sized to its words. */}
      <div className="flex justify-center py-2">
        <span className="inline-block max-w-full break-words rounded-[10px] px-7 py-3.5 text-center text-base font-bold leading-5" style={{ backgroundColor: color, color: contrastInk(color) }}>
          {data.label.trim() || 'Button text'}
        </span>
      </div>
      {selected && !readOnly ? (
        <div className="mt-3 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor={`${blockId}-label`} className={LABEL}>Button text</label>
            <input id={`${blockId}-label`} type="text" value={data.label} maxLength={LIMITS.button_label}
              onChange={(e) => onChange({ label: e.target.value })} className={inputClass()} />
          </div>
          <div className="min-w-0">
            <label htmlFor={`${blockId}-url`} className={LABEL}>Opens this link</label>
            <input id={`${blockId}-url`} type="text" inputMode="url" value={url.draft} placeholder="https://yourwebsite.com/offer"
              aria-invalid={url.invalid} aria-describedby={url.invalid ? `${blockId}-url-help` : undefined}
              onChange={(e) => url.change(e.target.value)} onBlur={url.blur} className={inputClass(url.invalid)} />
            {url.invalid ? <p id={`${blockId}-url-help`} role="alert" className="mt-1.5 text-xs text-red-600">Use a link that starts with https://.</p> : null}
          </div>
          <div className="sm:col-span-2">
            <ColorSwatches label="Button colour" idPrefix={`${blockId}-color`} value={color} onChange={(c) => onChange({ color: c })} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
