import { useLayoutEffect, useRef } from 'react';
import { Bold } from 'lucide-react';
import type { TitleBlockData, TitleSize } from '../../../services/newslettersAPI';
import { LIMITS } from '../lib/rules';
import { IMAGE_SHADOW, TITLE_INK, TITLE_SIZE_OPTIONS, readableInk, sectionLook, sectionStyleOf, stylePatch } from '../lib/sectionStyle';
import { AlignMenu, BackgroundMenu, FontMenu, SizeMenu, TextColorMenu, ToolbarDivider, ToolbarToggle, useRovingToolbar } from './StyleToolbar';
import { fontStack, titleTypeOf, titleTypePatch } from '../lib/fonts';
import type { BlockEditorProps } from './types';
import { SpacingMenu } from './SpacingMenu';
import { lineHeight, spacingOf, spacingPatch, toolbarGap } from '../lib/sectionSpacing';
import { titleLineHeightVar, titleSizeVar, titlePx } from '../lib/typeScale';
import { EditSizesPanel, useTypeScale } from '../TypeScale';

// The email's title sizes (NewsletterRenderer, line height + 8). Chris, 7 Nov: they follow the newsletter's text sizes
// (Small: Large, Medium and Large: X-Large; 18 / 22 / 28 px with the usual ones), drawn through CSS variables.
const TITLE_SIZES: readonly TitleSize[] = ['small', 'medium', 'large'];

/**
 * A Title section. Selected, a style toolbar above it (Chris, 5 Nov): Size (one dropdown instead of the pills), Align,
 * Text colour and Section background (colour, or an image with the colour as fallback). The background itself is drawn
 * by the section's frame (BlockFrame), edge to edge, as the email draws it.
 */
export default function TitleBlockEditor({ blockId, data, selected, readOnly, onChange }: BlockEditorProps<TitleBlockData>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const roving = useRovingToolbar();
  const scale = useTypeScale();
  const size: TitleSize = TITLE_SIZES.includes(data.size) ? data.size : 'medium';
  const look = sectionLook(data as unknown as Record<string, unknown>, true, TITLE_INK);
  const style = sectionStyleOf(data as unknown as Record<string, unknown>, true);
  // Chris (6 Nov): a title is bold unless turned off (bold: false), in the font picked for it (font; none: the usual).
  const type = titleTypeOf(data as unknown as Record<string, unknown>);
  const bold = type.bold !== false;
  // Chris (7 Nov): line spacing and the room above and below (the room is drawn by BlockFrame from sectionLook).
  const spacing = spacingOf(data as unknown as Record<string, unknown>, true);
  // Its px in this newsletter's text sizes (Chris, 7 Nov: type scale); line spacing moves its px + 8 line height.
  const sizePx = titlePx(scale.scale, size);
  // Grow with the text so the title reads like the email, not like a form field.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [data.text, data.size, data.font, data.bold, data.line_spacing, selected, scale.scale]);

  return (
    <div>
      {selected && !readOnly ? (
        <div ref={roving.ref} onFocus={roving.onFocus} onKeyDown={roving.onKeyDown} role="toolbar" aria-label="Title style" style={{ marginTop: toolbarGap(look.padY) }} className="-mx-3 mb-2 mt-2 inline-flex max-w-[calc(100%+1.5rem)] flex-wrap sm:mx-0 sm:max-w-full items-center gap-0 sm:gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <ToolbarToggle label="Bold" pressed={bold} onClick={() => onChange(titleTypePatch({ bold: !bold }))}><Bold className="h-4 w-4" aria-hidden="true" /></ToolbarToggle>
          <ToolbarDivider />
          <FontMenu value={type.font ?? null} onPick={(font) => onChange(titleTypePatch({ font }))} />
          <SizeMenu label="Title size" options={TITLE_SIZE_OPTIONS} value={data.size ?? 'medium'} preview={(s) => Math.min(titlePx(scale.scale, s), 22)} onPick={(size) => onChange({ size })}
            editSizes={scale.editable ? <EditSizesPanel /> : undefined} />
          <ToolbarDivider />
          <AlignMenu value={look.align} onPick={(align) => onChange(stylePatch({ align }))} />
          <TextColorMenu idPrefix={blockId} value={style.color ?? null} shown={look.ink} bg={look.bg} onPick={(color) => onChange(stylePatch({ color }))} />
          <BackgroundMenu idPrefix={blockId} allowImage color={style.background_color ?? null} image={style.background_image_url ?? null} textColor={style.color ?? null} sampleText={data.text}
            onColor={(c) => onChange(stylePatch({ background_color: c }))}
            onImage={(url) => onChange(stylePatch({ background_image_url: url }))}
            // Colour takes the picture away (as the header's switch does); Image waits for an upload.
            // Image starts from the dark fallback when the band was light (white words read on it where pictures are hidden).
            onMode={(mode) => {
              if (mode === 'color' && style.background_image_url) onChange(stylePatch({ background_image_url: null }));
              else if (mode === 'image' && !style.background_image_url && style.background_color && readableInk(style.background_color, TITLE_INK) !== '#FFFFFF') onChange(stylePatch({ background_color: null }));
            }} />
          <SpacingMenu lineSpacing={spacing.line_spacing ?? 'normal'} padding={spacing.padding ?? 'normal'}
            onLineSpacing={(line_spacing) => onChange(spacingPatch({ line_spacing }))} onPadding={(padding) => onChange(spacingPatch({ padding }))} />
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
        style={{ color: look.ink, textAlign: look.align, textShadow: look.image ? IMAGE_SHADOW : undefined, fontWeight: bold ? 700 : 400, fontFamily: type.font ? fontStack(type.font) : undefined, fontSize: titleSizeVar(size), lineHeight: spacing.line_spacing ? `${lineHeight(sizePx, sizePx + 8, spacing.line_spacing)}px` : titleLineHeightVar(size) }}
        className={`block w-full resize-none overflow-hidden bg-transparent p-0 outline-none ${look.styled && look.ink === '#FFFFFF' ? 'placeholder:text-white/60' : 'placeholder:text-gray-300'}`}
      />
    </div>
  );
}
