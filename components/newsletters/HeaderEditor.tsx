import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { NewsletterHeader } from '../../services/newslettersAPI';
import ColorSwatches from './ColorSwatches';
import SegmentedSwitch from './SegmentedSwitch';
import { useImageUpload } from './hooks/useImageUpload';
import { contrastInk, safeHexColor } from './lib/colors';
import { LIMITS } from './lib/rules';
import { httpsUrl } from './lib/urls';
import { BUTTON_SMALL, BUTTON_SMALL_PRIMARY, LABEL, LINK_BUTTON, PURPLE, inputClass } from './lib/ui';

const BACKGROUNDS = [
  { value: 'color', label: 'Colour' },
  { value: 'banner', label: 'Banner image' },
] as const;

/**
 * The email's header, drawn like emails/newsletter/header.blade.php: a banner image across the top when there
 * is one, then the logo and title on the background colour. It is part of the draft; the newsletter PUT also
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
  const ink = contrastInk(color);
  const [mode, setMode] = useState<'color' | 'banner'>(banner ? 'banner' : 'color');
  useEffect(() => { if (banner) setMode('banner'); }, [banner]);
  const logoUpload = useImageUpload((url) => onChange((h) => ({ ...h, logo_url: url })), 'nl-logo-input');
  const bannerUpload = useImageUpload((url) => onChange((h) => ({ ...h, banner_url: url })), 'nl-banner-input');
  const title = header.title?.trim() ?? '';
  const placeholder = !title && !logo && !readOnly;

  const chooseMode = (next: 'color' | 'banner') => {
    setMode(next);
    if (next === 'color' && header.banner_url) onChange({ ...header, banner_url: null });
  };

  return (
    // A tab stop of its own (Enter or Space selects it), so the header can be edited without a mouse.
    <div role="group" aria-label="Header" data-nl-header="" data-nl-selected={selected && !readOnly ? 'true' : undefined} tabIndex={readOnly ? -1 : 0} onClick={onSelect} onFocusCapture={onSelect}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(); } }}
      className={`relative outline outline-2 -outline-offset-2 transition-[outline-color] focus-visible:outline-[#6C60FF]/60 ${selected ? 'outline-[#6C60FF]' : 'outline-transparent hover:outline-[#6C60FF]/30'}`}>
      <div style={{ backgroundColor: color }}>
        {banner ? <img src={banner} alt={title} className="block h-auto w-full" /> : null}
        {title || logo || placeholder ? (
          <div className={`flex flex-col items-center text-center ${banner ? `${padClass} py-6` : `${padClass} py-8`}`}>
            {logo ? <img src={logo} alt={title || 'Logo'} className={`h-12 w-auto max-w-[240px] object-contain ${title ? 'mb-3' : ''}`} /> : null}
            {title || placeholder ? (
              <p className={`break-words text-[1.625rem] font-bold leading-[2.125rem] ${placeholder ? 'opacity-60' : ''}`} style={{ color: ink }}>{title || 'Your business name'}</p>
            ) : null}
          </div>
        ) : null}
      </div>
      {logoUpload.input}
      {bannerUpload.input}
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
            {logo ? <button type="button" onClick={() => onChange({ ...header, logo_url: null })} className={LINK_BUTTON}>Remove logo</button> : null}
          </div>
          <div className="space-y-3">
            <SegmentedSwitch label="Header background" options={BACKGROUNDS} value={mode} onChange={chooseMode} />
            {mode === 'banner' ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={bannerUpload.choose} disabled={bannerUpload.uploading} className={BUTTON_SMALL}>
                  {bannerUpload.uploading ? 'Uploading…' : banner ? 'Replace banner' : 'Upload banner image'}
                </button>
                {banner ? <button type="button" onClick={() => onChange({ ...header, banner_url: null })} className={LINK_BUTTON}>Remove banner</button> : null}
                <span className="text-xs text-gray-500">Wide images work best (1200 × 400).</span>
              </div>
            ) : null}
            <ColorSwatches label={mode === 'banner' ? 'Colour behind the logo and title' : 'Background colour'} idPrefix="nl-header-color" value={color}
              onChange={(c) => onChange({ ...header, background_color: c })} />
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
