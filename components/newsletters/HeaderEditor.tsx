import { useEffect, useState } from 'react';
import type { NewsletterHeader } from '../../services/newslettersAPI';
import ColorSwatches from './ColorSwatches';
import SegmentedSwitch from './SegmentedSwitch';
import { useImageUpload } from './hooks/useImageUpload';
import { contrastInk, safeHexColor } from './lib/colors';
import { LIMITS } from './lib/rules';
import { httpsUrl } from './lib/urls';
import { BUTTON_SMALL, LABEL, LINK_BUTTON, PURPLE, inputClass } from './lib/ui';

const BACKGROUNDS = [
  { value: 'color', label: 'Colour' },
  { value: 'banner', label: 'Banner image' },
] as const;

/**
 * The email's header, drawn like emails/newsletter/header.blade.php: a banner image across the top when there
 * is one, then the logo and title on the background colour. It is part of the draft; the newsletter PUT also
 * saves it as the account's brand header, which pre-fills the next newsletter (contract note 8).
 */
export default function HeaderEditor({ header, onChange, selected, onSelect, readOnly, padClass = 'px-10' }: {
  header: NewsletterHeader;
  onChange(header: NewsletterHeader): void;
  selected: boolean;
  onSelect(): void;
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
  const logoUpload = useImageUpload((url) => onChange({ ...header, logo_url: url }), 'nl-logo-input');
  const bannerUpload = useImageUpload((url) => onChange({ ...header, banner_url: url }), 'nl-banner-input');
  const title = header.title?.trim() ?? '';
  const placeholder = !title && !logo && !readOnly;

  const chooseMode = (next: 'color' | 'banner') => {
    setMode(next);
    if (next === 'color' && header.banner_url) onChange({ ...header, banner_url: null });
  };

  return (
    <div role="group" aria-label="Header" tabIndex={-1} onClick={onSelect} onFocusCapture={onSelect}
      className={`relative outline outline-2 -outline-offset-2 transition-[outline-color] ${selected ? 'outline-[#6C60FF]' : 'outline-transparent hover:outline-[#6C60FF]/30'}`}>
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
        <div className="grid gap-4 border-b border-gray-100 bg-gray-50 p-4">
          <div>
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
          <p className="text-xs text-gray-500">Your header is saved for your next newsletter too.</p>
        </div>
      ) : null}
    </div>
  );
}
