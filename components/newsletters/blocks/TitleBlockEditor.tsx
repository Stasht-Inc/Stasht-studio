import { useLayoutEffect, useRef } from 'react';
import type { TitleBlockData, TitleSize } from '../../../services/newslettersAPI';
import { LIMITS } from '../lib/rules';
import { IMAGE_SHADOW, TITLE_INK, TITLE_SIZE_OPTIONS, sectionLook, sectionStyleOf, stylePatch } from '../lib/sectionStyle';
import { AlignMenu, BackgroundMenu, SizeMenu, TextColorMenu, ToolbarDivider, useRovingToolbar } from './StyleToolbar';
import type { BlockEditorProps } from './types';

// The email's title sizes (NewsletterRenderer::TITLE_PX 18 / 22 / 28, line height + 8), in rem.
export const TITLE_CLASS: Record<TitleSize, string> = {
  small: 'text-lg leading-[1.625rem]',
  medium: 'text-[1.375rem] leading-[1.875rem]',
  large: 'text-[1.75rem] leading-[2.25rem]',
};
const TITLE_PX: Record<TitleSize, number> = { small: 18, medium: 22, large: 28 };

/**
 * A Title section. Selected, a style toolbar above it (Chris, 5 Nov): Size (one dropdown instead of the pills), Align,
 * Text colour and Section background (colour, or an image with the colour as fallback). The background itself is drawn
 * by the section's frame (BlockFrame), edge to edge, as the email draws it.
 */
export default function TitleBlockEditor({ blockId, data, selected, readOnly, onChange }: BlockEditorProps<TitleBlockData>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const roving = useRovingToolbar();
  const look = sectionLook(data as unknown as Record<string, unknown>, true, TITLE_INK);
  const style = sectionStyleOf(data as unknown as Record<string, unknown>, true);
  // Grow with the text so the title reads like the email, not like a form field.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [data.text, data.size, selected]);

  return (
    <div>
      {selected && !readOnly ? (
        <div ref={roving.ref} onFocus={roving.onFocus} onKeyDown={roving.onKeyDown} role="toolbar" aria-label="Title style" className="mb-2 mt-2 inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <SizeMenu label="Title size" options={TITLE_SIZE_OPTIONS} value={data.size ?? 'medium'} preview={(s) => Math.min(TITLE_PX[s], 22)} onPick={(size) => onChange({ size })} />
          <ToolbarDivider />
          <AlignMenu value={look.align} onPick={(align) => onChange(stylePatch({ align }))} />
          <TextColorMenu idPrefix={blockId} value={style.color ?? null} shown={look.ink} onPick={(color) => onChange(stylePatch({ color }))} />
          <BackgroundMenu idPrefix={blockId} allowImage color={style.background_color ?? null} image={style.background_image_url ?? null}
            onColor={(c) => onChange(stylePatch({ background_color: c }))}
            onImage={(url) => onChange(stylePatch({ background_image_url: url }))}
            // Colour takes the picture away (as the header's switch does); Image waits for an upload.
            onMode={(mode) => { if (mode === 'color' && style.background_image_url) onChange(stylePatch({ background_image_url: null })); }} />
        </div>
      ) : null}
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
        style={{ color: look.ink, textAlign: look.align, textShadow: look.image ? IMAGE_SHADOW : undefined }}
        className={`block w-full resize-none overflow-hidden bg-transparent p-0 font-bold outline-none ${look.styled && look.ink === '#FFFFFF' ? 'placeholder:text-white/60' : 'placeholder:text-gray-300'} ${TITLE_CLASS[data.size] ?? TITLE_CLASS.medium}`}
      />
    </div>
  );
}
