import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { qrCodesAPI, QR_GENERIC_ERROR } from '../../services/qrCodesAPI';
import { qrFileName, type QrCode } from '../../utils/qrCodes';
import { COLOR_PRESETS, paintQr, printSafeColor, qrDrawColor, qrSvg, svgDataUrl } from '../../utils/qrStyle';
import { loadQrLogo, loadedQrLogo, primeQrLogo, type PreparedLogo } from '../../utils/qrLogo';
import { keyboardOnlyFocusReturn } from '../../utils/menuFocus';
import { BUTTON_SMALL } from '../newsletters/lib/ui';

// Branded QR codes (Chris, 3 Nov 2026): one look everywhere — the list thumbnail, the code's view and every download
// are drawn by utils/qrStyle from the same code, image and colour.

/** The PNG downloads are exactly this many pixels square. */
export const PNG_SIZE = 4096;
export const PRINT_TIP = 'Print at least 2.5 cm (1 in) wide · dark code on a light background';
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type LogoState = { key: string | null; logo: PreparedLogo | null; ready: boolean };
const logoState = (key: string | null): LogoState => {
  if (!key) return { key, logo: null, ready: true };
  const have = loadedQrLogo(key);
  return have ? { key, logo: have, ready: true } : { key, logo: null, ready: false };
};

/** The code's centre image, loaded once per image (codes sharing the default avatar share it). */
export function useQrLogo(code: Pick<QrCode, 'logoUrl'>): LogoState {
  const [state, setState] = useState<LogoState>(() => logoState(code.logoUrl));
  useEffect(() => {
    const first = logoState(code.logoUrl);
    setState(first);
    if (first.ready) return undefined;
    let live = true;
    void loadQrLogo(code.logoUrl, qrCodesAPI.logoImage).then((logo) => {
      if (live) setState({ key: code.logoUrl, logo, ready: true });
    });
    return () => { live = false; };
  }, [code.logoUrl]);
  return state.key === code.logoUrl ? state : logoState(code.logoUrl);
}

/**
 * The code as it prints. color: undefined → the code's saved colour; null → auto (the logo's); a colour → that one
 * (a live preview while picking). Drawn at twice its size so it stays crisp on retina screens.
 */
export function BrandedQr({ code, size, color, label }: {
  code: Pick<QrCode, 'shortUrl' | 'logoUrl' | 'color'>;
  size: number;
  color?: string | null;
  label?: string;
}) {
  const { logo, ready } = useQrLogo(code);
  const drawColor = qrDrawColor(color === undefined ? code.color : color, logo?.color);
  const src = useMemo(
    () => (ready ? svgDataUrl(qrSvg(code.shortUrl, { color: drawColor, background: 'white', logo: logo ? { href: logo.href, width: logo.width, height: logo.height } : null }, size * 2)) : null),
    [ready, code.shortUrl, drawColor, logo, size],
  );
  if (!src) {
    return <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="block animate-pulse rounded bg-gray-100" style={{ width: size, height: size }} />;
  }
  return <img src={src} width={size} height={size} alt={label ?? ''} aria-hidden={label ? undefined : true} data-qr-color={drawColor} className="block" draggable={false} />;
}

/** The colour "Auto" stands for: the logo's, print safe (near-black without a usable one). */
export function useAutoColor(code: Pick<QrCode, 'logoUrl'>): string {
  const { logo } = useQrLogo(code);
  return qrDrawColor(null, logo?.color);
}

export type QrDownloadKind = 'png' | 'png-transparent' | 'svg';

function saveBlob(blob: Blob, file: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A download, drawn exactly as the code shows: SVG (vector, logo inside), PNG 4096 on white, or PNG 4096 transparent. */
export async function downloadQr(code: QrCode, kind: QrDownloadKind): Promise<void> {
  try {
    const logo = await loadQrLogo(code.logoUrl, qrCodesAPI.logoImage);
    const color = qrDrawColor(code.color, logo?.color);
    if (kind === 'svg') {
      const svg = qrSvg(code.shortUrl, { color, background: 'white', logo: logo ? { href: logo.href, width: logo.width, height: logo.height } : null });
      saveBlob(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: 'image/svg+xml' }), qrFileName(code.name, 'svg'));
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = PNG_SIZE;
    canvas.height = PNG_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no context');
    const background = kind === 'png' ? 'white' : 'transparent';
    paintQr(ctx, code.shortUrl, { color, background, image: logo?.image ?? null, imageWidth: logo?.width ?? 0, imageHeight: logo?.height ?? 0 }, PNG_SIZE);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('no blob');
    saveBlob(blob, qrFileName(code.name, 'png', background === 'transparent' ? 'transparent' : undefined));
  } catch {
    toast.error("Couldn't make the download. Please try again.");
  }
}

/** The Download menu: the three files and the print tip. */
export function QrDownloadMenu({ code, children, disabled }: { code: QrCode; children: ReactNode; disabled?: boolean }) {
  const item = 'cursor-pointer hover:bg-[#6C60FF]/5';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-md border border-gray-200 bg-white shadow-lg" onCloseAutoFocus={keyboardOnlyFocusReturn}>
        <DropdownMenuItem className={item} onSelect={() => void downloadQr(code, 'png')}>PNG · white background</DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => void downloadQr(code, 'png-transparent')}>PNG · transparent</DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => void downloadQr(code, 'svg')}>SVG · vector</DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs leading-snug text-gray-500">{PRINT_TIP}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Image (Change / Remove) and Colour (Auto, a few presets, Custom) for one code; each change saves at once.
 * onPreview: the colour to draw while the custom picker is open (undefined: the saved one).
 */
export function QrStyleControls({ code, onChanged, onPreview }: {
  code: QrCode;
  onChanged(code: QrCode): void;
  onPreview(color: string | null | undefined): void;
}) {
  const [busy, setBusy] = useState<'upload' | 'remove' | 'default' | 'color' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const swatchRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const autoColor = useAutoColor(code);
  const saved = code.color;
  const presetIndex = saved ? COLOR_PRESETS.findIndex((p) => p.hex === saved) : -1;
  const custom = saved !== null && presetIndex === -1;
  const hasImage = code.logoUrl !== null;
  // Offered when the code shows its own image or none, and there is a default to go back to.
  const canUseDefault = code.logoMode !== 'default' && code.logoDefaultUrl !== null;

  const saveColor = async (color: string | null) => {
    if (color === saved) { onPreview(undefined); return; }
    setBusy('color');
    onPreview(color);
    const res = await qrCodesAPI.update(code.id, { color });
    setBusy(null);
    onPreview(undefined);
    if (res.ok && res.data) onChanged(res.data);
    else toast.error(res.error ?? QR_GENERIC_ERROR);
  };

  // The custom picker previews while it moves and saves once, when it closes (the native change event).
  useEffect(() => {
    const input = customRef.current;
    if (!input) return undefined;
    const commit = () => void saveColor(printSafeColor(input.value.toUpperCase()));
    input.addEventListener('change', commit);
    return () => input.removeEventListener('change', commit);
  });

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      toast.error('Choose a JPG, PNG, GIF or WebP image up to 5 MB.');
      return;
    }
    setBusy('upload');
    const up = await qrCodesAPI.uploadImage(file);
    if (!up.ok || !up.data) {
      setBusy(null);
      toast.error(up.error ?? QR_GENERIC_ERROR);
      return;
    }
    const res = await qrCodesAPI.update(code.id, { logo_mode: 'custom', logo_url: up.data });
    setBusy(null);
    if (res.ok && res.data) {
      primeQrLogo(res.data.logoUrl, file);
      onChanged(res.data);
    } else {
      toast.error(res.error ?? QR_GENERIC_ERROR);
    }
  };

  // Remove image (logo_mode none), or go back to the default image (logo_mode default).
  const setLogoMode = async (mode: 'none' | 'default') => {
    setBusy(mode === 'none' ? 'remove' : 'default');
    const res = await qrCodesAPI.update(code.id, { logo_mode: mode });
    setBusy(null);
    if (res.ok && res.data) onChanged(res.data);
    else toast.error(res.error ?? QR_GENERIC_ERROR);
  };

  // Radios: Auto, then the presets; arrow keys move and choose.
  const options: Array<string | null> = [null, ...COLOR_PRESETS.map((p) => p.hex)];
  // -1: a custom colour (no radio chosen; Custom shows it).
  const activeIndex = saved === null ? 0 : presetIndex >= 0 ? presetIndex + 1 : -1;
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    swatchRefs.current[next]?.focus();
    void saveColor(options[next]);
  };
  const ring = (active: boolean) => (active ? 'border-gray-900' : 'border-white shadow-[0_0_0_1px_#e5e7eb]');

  return (
    <div className="w-full space-y-3 text-left">
      <div className="flex items-start gap-3">
        <span className="w-14 flex-shrink-0 pt-1.5 text-sm font-medium text-gray-900">Image</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null} className={BUTTON_SMALL}>
            {busy === 'upload' ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Uploading…</> : hasImage ? 'Change image' : 'Add image'}
          </button>
          {hasImage ? (
            <button type="button" onClick={() => void setLogoMode('none')} disabled={busy !== null} className={BUTTON_SMALL}>
              {busy === 'remove' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}Remove image
            </button>
          ) : null}
          {canUseDefault ? (
            <button type="button" onClick={() => void setLogoMode('default')} disabled={busy !== null} className={BUTTON_SMALL}>
              {busy === 'default' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}Use profile picture
            </button>
          ) : null}
          <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(',')} className="hidden" aria-label="Image for the QR code"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void pickFile(f); }} />
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span id={`qr-colour-${code.id}`} className="w-14 flex-shrink-0 pt-1 text-sm font-medium text-gray-900">Colour</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div role="radiogroup" aria-labelledby={`qr-colour-${code.id}`} className="flex flex-wrap items-center gap-2">
            <button
              ref={(el) => { swatchRefs.current[0] = el; }}
              type="button" role="radio" aria-checked={activeIndex === 0} title="The image's main colour"
              tabIndex={activeIndex === 0 || custom ? 0 : -1} disabled={busy === 'color'}
              onClick={() => void saveColor(null)} onKeyDown={(e) => onKeyDown(e, 0)}
              className={`flex h-7 items-center gap-1.5 rounded-full border px-2 text-xs text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 ${activeIndex === 0 ? 'border-gray-900' : 'border-gray-200'}`}
            >
              <span aria-hidden="true" className="h-4 w-4 rounded-full" style={{ backgroundColor: autoColor }} />
              Auto
            </button>
            {COLOR_PRESETS.map((p, i) => (
              <button
                key={p.hex}
                ref={(el) => { swatchRefs.current[i + 1] = el; }}
                type="button" role="radio" aria-checked={activeIndex === i + 1} aria-label={p.name} title={p.name}
                tabIndex={activeIndex === i + 1 ? 0 : -1} disabled={busy === 'color'}
                onClick={() => void saveColor(p.hex)} onKeyDown={(e) => onKeyDown(e, i + 1)}
                className={`h-7 w-7 rounded-full border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 focus-visible:ring-offset-1 ${ring(activeIndex === i + 1)}`}
                style={{ backgroundColor: p.hex }}
              />
            ))}
          </div>
          <label className={`relative flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2 text-xs text-gray-700 focus-within:ring-2 focus-within:ring-[#6C60FF]/40 ${custom ? 'border-gray-900' : 'border-gray-200'}`}>
            <span aria-hidden="true" className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: custom && saved ? saved : '#FFFFFF' }} />
            Custom
            <input ref={customRef} key={saved ?? 'auto'} type="color" defaultValue={(custom && saved ? saved : autoColor).toLowerCase()} aria-label="Colour: custom"
              disabled={busy === 'color'}
              onChange={(e) => onPreview(printSafeColor(e.target.value.toUpperCase()))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </label>
        </div>
      </div>
    </div>
  );
}
