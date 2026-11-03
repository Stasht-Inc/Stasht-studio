import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { NewsletterHeader } from '../../services/newslettersAPI';
import ColorSwatches from './ColorSwatches';
import SegmentedSwitch from './SegmentedSwitch';
import { useImageUpload } from './hooks/useImageUpload';
import { safeHexColor } from './lib/colors';
import {
  BACKGROUND_MODES, BACKGROUND_SHADE, FALLBACK_HINT, LOGO_SIZES, TITLE_SHADOW, fallbackInk, backgroundModeOf, headerInk, logoHeight, logoRatioFrom, logoSizeOf, needsLogoRatio,
  withBackgroundImage, withBackgroundMode, withLogo, withLogoSize, withoutBanner, type HeaderBackgroundMode,
} from './lib/headerDesign';
import { LIMITS } from './lib/rules';
import { httpsUrl } from './lib/urls';
import { BUTTON_SMALL, BUTTON_SMALL_PRIMARY, LABEL, LINK_BUTTON, PURPLE, inputClass } from './lib/ui';

/** The logo is never drawn wider than the 518 px inside the email header's 40 px sides (header.blade.php). */
const LOGO_MAX_WIDTH = 518;

/**
 * The email's header, drawn like emails/newsletter/header.blade.php: the logo and title on the background colour,
 * or on a background picture under a dark layer ("Header background: Colour | Image", Chris, 3 Nov). A banner across
 * the top is only drawn for headers saved with one before (no new banners; it can be removed). The logo is small
 * (48 px, as before), medium or large. It is part of the draft; the newsletter PUT also
 * saves it as the account's brand header, which pre-fills the next newsletter (contract note 8).
 */
export default function HeaderEditor({ header, onChange, selected, onSelect, onDone, readOnly, padClass = 'px-10' }: {
  header: NewsletterHeader;
  /** The new header, or (for uploads, which finish later) a function of the latest one. */
  onChange(header: NewsletterHeader | ((latest: NewsletterHeader) => NewsletterHeader)): void;
  selected: boolean;
  onSelect(): void;
  /** Done / × : close the editor (changes are already saved). */
  onDone?(): void;
  readOnly: boolean;
  /** Side padding of the email column (40 px wide, 20 px on phones). */
  padClass?: string;
}) {
  const color = safeHexColor(header.background_color, PURPLE);
  const banner = httpsUrl(header.banner_url);
  const logo = httpsUrl(header.logo_url);
  const picture = httpsUrl(header.background_image_url);
  const ink = headerInk(color, picture !== null);
  const logoSize = logoSizeOf(header);
  // The loaded logo's width ÷ height: a bigger logo is sized with it here and in the email (logo_ratio).
  const [measured, setMeasured] = useState<{ url: string; ratio: number | null } | null>(null);
  const ratio = (measured && measured.url === logo ? measured.ratio : null) ?? header.logo_ratio ?? null;
  // Header background (3 Nov): one switch, Colour or Image. Image without a picture yet shows the upload button.
  const [mode, setMode] = useState<HeaderBackgroundMode>(backgroundModeOf(header));
  useEffect(() => { if (picture) setMode('image'); }, [picture]);
  const logoUpload = useImageUpload((url) => onChange((h) => withLogo(h, url)), 'nl-logo-input');
  const pictureUpload = useImageUpload((url) => onChange((h) => withBackgroundImage(h, url)), 'nl-header-bg-input');
  const title = header.title?.trim() ?? '';
  const placeholder = !title && !logo && !readOnly;

  const onLogoLoad = (img: HTMLImageElement) => {
    const shape = logoRatioFrom(img.naturalWidth, img.naturalHeight);
    if (logo) setMeasured({ url: logo, ratio: shape });
    // A bigger logo saved without its shape (or with another logo's): keep it with the header for the email.
    if (!readOnly && shape !== null && needsLogoRatio(header, shape)) {
      onChange((h) => (httpsUrl(h.logo_url) === logo && needsLogoRatio(h, shape) ? { ...h, logo_ratio: shape } : h));
    }
  };
  const height = logoHeight(header);
  // Like header-logo.blade.php: small is the old 48 px; bigger with a known shape is that width (shrinking on a
  // narrow screen), else that height.
  const logoStyle = logoSize === 'small' ? undefined
    : ratio !== null ? { width: Math.min(Math.round(height * ratio), LOGO_MAX_WIDTH), maxWidth: '100%', height: 'auto' }
      : { height, width: 'auto', maxWidth: '100%' };

  const chooseMode = (next: HeaderBackgroundMode) => {
    setMode(next);
    const changed = withBackgroundMode(header, next);
    if (changed !== header) onChange(changed);
  };

  return (
    // A tab stop of its own (Enter or Space selects it), so the header can be edited without a mouse.
    <div role="group" aria-label="Header" data-nl-header="" data-nl-selected={selected && !readOnly ? 'true' : undefined} tabIndex={readOnly ? -1 : 0} onClick={onSelect} onFocusCapture={onSelect}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(); } }}
      className={`relative outline outline-2 -outline-offset-2 transition-[outline-color] focus-visible:outline-[#6C60FF]/60 ${selected ? 'outline-[#6C60FF]' : 'outline-transparent hover:outline-[#6C60FF]/30'}`}>
      <div style={{ backgroundColor: color }}>
        {banner ? <img src={banner} alt={title} className="block h-auto w-full" /> : null}
        {title || logo || placeholder || picture ? (
          <div data-nl-header-picture={picture ? '' : undefined}
            style={picture ? { backgroundImage: `url(${JSON.stringify(picture)})`, backgroundSize: 'cover', backgroundPosition: 'center center', backgroundRepeat: 'no-repeat' } : undefined}>
            <div className={`flex flex-col items-center text-center ${banner ? `${padClass} py-6` : `${padClass} py-8`}`}
              style={picture ? { backgroundColor: BACKGROUND_SHADE } : undefined}>
              {logo ? (
                <img src={logo} alt={title || 'Logo'} data-nl-logo-size={logoSize} onLoad={(e) => onLogoLoad(e.currentTarget)} style={logoStyle}
                  className={`${logoSize === 'small' ? 'h-12 w-auto max-w-[240px]' : ''} object-contain ${title ? 'mb-3' : ''}`} />
              ) : null}
              {title || placeholder ? (
                <p className={`break-words text-[1.625rem] font-bold leading-[2.125rem] ${placeholder ? 'opacity-60' : ''}`} style={{ color: ink, textShadow: picture ? TITLE_SHADOW : undefined }}>{title || 'Your business name'}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {logoUpload.input}
      {pictureUpload.input}
      {selected && !readOnly ? (
        <div className="relative grid gap-4 border-b border-gray-100 bg-gray-50 p-4">
          {onDone ? (
            <button type="button" aria-label="Close editor" title="Close editor" onClick={(e) => { e.stopPropagation(); onDone(); }}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <div className="pr-8">
            <label htmlFor="nl-header-title" className={LABEL}>Header title</label>
            <input id="nl-header-title" type="text" value={header.title ?? ''} maxLength={LIMITS.title} placeholder="Your business name"
              onChange={(e) => onChange({ ...header, title: e.target.value })} className={inputClass()} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900">Logo</span>
            <button type="button" onClick={logoUpload.choose} disabled={logoUpload.uploading} className={BUTTON_SMALL}>
              {logoUpload.uploading ? 'Uploading…' : logo ? 'Replace logo' : 'Upload logo'}
            </button>
            {logo ? <button type="button" onClick={() => onChange(withLogo(header, null))} className={LINK_BUTTON}>Remove logo</button> : null}
            {logo ? <SegmentedSwitch label="Logo size" options={LOGO_SIZES} value={logoSize} onChange={(size) => onChange(withLogoSize(header, size, ratio))} /> : null}
          </div>
          <div className="space-y-3">
            <SegmentedSwitch label="Header background" options={BACKGROUND_MODES} value={mode} onChange={chooseMode} />
            {mode === 'image' ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={pictureUpload.choose} disabled={pictureUpload.uploading} className={BUTTON_SMALL}>
                  {pictureUpload.uploading ? 'Uploading…' : picture ? 'Replace image' : 'Upload image'}
                </button>
                {picture ? <button type="button" onClick={() => onChange(withBackgroundImage(header, null))} className={LINK_BUTTON}>Remove image</button> : null}
              </div>
            ) : null}
            {/* Banners are no longer offered (3 Nov); a header saved with one still draws it and can drop it. */}
            {banner ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span>Banner image in use</span>
                <span aria-hidden="true">·</span>
                <button type="button" onClick={() => onChange(withoutBanner(header))} className={LINK_BUTTON}>Remove banner</button>
              </div>
            ) : null}
            <div>
              <ColorSwatches label={mode === 'image' ? 'Fallback colour' : 'Background colour'} idPrefix="nl-header-color" value={color}
                onChange={(c) => onChange({ ...header, background_color: c })} />
              {mode === 'image' ? (
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {/* How the header reads there: the fallback colour with a name that contrasts (as the email). */}
                  <span data-nl-fallback-sample="" className="inline-flex h-6 max-w-[12rem] items-center truncate rounded px-2 font-semibold"
                    style={{ backgroundColor: color, color: fallbackInk(color) }}>{title || 'Your business name'}</span>
                  {FALLBACK_HINT}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Your header is saved for your next newsletter too.</p>
            {onDone ? <button type="button" onClick={(e) => { e.stopPropagation(); onDone(); }} className={`${BUTTON_SMALL_PRIMARY} ml-auto`}>Done</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
