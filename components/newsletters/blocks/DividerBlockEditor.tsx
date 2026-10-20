import type { DividerBlockData } from '../../../services/newslettersAPI';
import SegmentedSwitch from '../SegmentedSwitch';
import type { BlockEditorProps } from './types';

const STYLES = [
  { value: 'line', label: 'Line' },
  { value: 'space', label: 'Space' },
] as const;

/** A 1 px grey line, or 24 px of space (blocks/divider.blade.php). */
export default function DividerBlockEditor({ data, selected, readOnly, onChange }: BlockEditorProps<DividerBlockData>) {
  return (
    <div>
      {data.style === 'space'
        ? <div aria-hidden="true" className={`h-6 rounded ${selected ? 'border border-dashed border-gray-300' : ''}`} />
        : <div aria-hidden="true" className="flex h-6 items-center"><hr className="w-full border-0 border-t border-gray-200" /></div>}
      {selected && !readOnly ? (
        <SegmentedSwitch label="Divider style" options={STYLES} value={data.style} onChange={(style) => onChange({ style })} className="mt-2" />
      ) : null}
    </div>
  );
}
