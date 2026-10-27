import { useLayoutEffect, useRef } from 'react';
import type { TitleBlockData, TitleSize } from '../../../services/newslettersAPI';
import SegmentedSwitch from '../SegmentedSwitch';
import { LIMITS } from '../lib/rules';
import type { BlockEditorProps } from './types';

// The email's title sizes (NewsletterRenderer::TITLE_PX 18 / 22 / 28, line height + 8), in rem.
export const TITLE_CLASS: Record<TitleSize, string> = {
  small: 'text-lg leading-[1.625rem]',
  medium: 'text-[1.375rem] leading-[1.875rem]',
  large: 'text-[1.75rem] leading-[2.25rem]',
};
const SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
] as const;

export default function TitleBlockEditor({ blockId, data, selected, readOnly, onChange }: BlockEditorProps<TitleBlockData>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Grow with the text so the title reads like the email, not like a form field.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [data.text, data.size, selected]);

  return (
    <div>
      <label htmlFor={`${blockId}-title`} className="sr-only">Title</label>
      <textarea
        ref={ref}
        id={`${blockId}-title`}
        rows={1}
        value={data.text}
        maxLength={LIMITS.title}
        readOnly={readOnly}
        placeholder="Add a title"
        onChange={(e) => onChange({ text: e.target.value.replace(/\n/g, ' ') })}
        className={`block w-full resize-none overflow-hidden bg-transparent p-0 font-bold text-gray-900 outline-none placeholder:text-gray-300 ${TITLE_CLASS[data.size] ?? TITLE_CLASS.medium}`}
      />
      {selected && !readOnly ? (
        <SegmentedSwitch label="Title size" options={SIZES} value={data.size} onChange={(size) => onChange({ size })} className="mt-2" />
      ) : null}
    </div>
  );
}
