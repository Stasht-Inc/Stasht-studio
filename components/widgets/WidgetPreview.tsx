import { MessageCircle, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import {
  CALLOUT_SUBTEXT, CONSENT_LINE, DEFAULT_CALLOUT, DEFAULT_WELCOME, FORM_FIELD_KEYS, contrastInk, fieldPlaceholder,
  resolveFormFields, safeColor, safeHttpsUrl, STASHT_MARK_PATH, STASHT_MARK_VIEWBOX,
} from './widgetHelpers';
import type { FormFieldSettings, WidgetBubblePosition } from '../../services/widgetsAPI';

export interface WidgetPreviewValues {
  agentName: string;
  calloutText: string;
  welcomeSubtext: string;
  primaryColor: string; // may be '' or partially typed; falls back to the embed default
  logoUrl: string;
  position: WidgetBubblePosition;
  formFields?: FormFieldSettings;
  // Sample "who's online" (the embed shows the real team from the server).
  online?: { name: string; initials: string; color: string; avatarUrl?: string | null }[];
}

// Mirrors public/widget-embed.html + widget-embed.js, which follow Chris's ContactWidget frames:
// callout card + round launcher when closed; agent header, intro bubble and form when open.
// Static: nothing here submits.
const font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const inputStyle: CSSProperties = {
  width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 11, background: '#fff',
  color: '#9ca3af', fontSize: 16, boxSizing: 'border-box',
};

function initialsInk(hex: string): string {
  const h = safeColor(hex, '#6C60FF').slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.8 ? '#1f2937' : '#ffffff';
}

function Faces({ online }: { online: NonNullable<WidgetPreviewValues['online']> }) {
  return (
    <span style={{ display: 'flex' }} aria-hidden="true">
      {online.map((m, i) => {
        const photo = safeHttpsUrl(m.avatarUrl ?? '');
        const color = safeColor(m.color, '#6C60FF');
        return (
          <span key={`${m.name}-${i}`} style={{ position: 'relative', zIndex: 4 - i, width: 32, height: 32, marginLeft: i === 0 ? 0 : -8, borderRadius: '50%', border: '2px solid #fff', background: '#fff' }}>
            {photo ? (
              <img src={photo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: '50%', background: color, color: initialsInk(color), fontSize: 11.5, fontWeight: 700 }}>
                {m.initials}
              </span>
            )}
            <span style={{ position: 'absolute', right: -2, bottom: -2, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />
          </span>
        );
      })}
    </span>
  );
}

export function WidgetPreview({ values, mode }: { values: WidgetPreviewValues; mode: 'closed' | 'open' }) {
  const brand = safeColor(values.primaryColor);
  const ink = contrastInk(brand);
  const logo = safeHttpsUrl(values.logoUrl);
  const title = values.calloutText.trim() || DEFAULT_CALLOUT;
  const agent = values.agentName.trim() || 'Chat with us';
  const welcome = values.welcomeSubtext.trim() || DEFAULT_WELCOME;
  const left = values.position === 'bottom-left';
  const fields = values.formFields || resolveFormFields(null);
  const shown = FORM_FIELD_KEYS.filter((k) => fields[k].show);
  const online = (values.online || []).slice(0, 4);

  const picture = (size: number, iconSize: number, bg: string) => (logo
    ? <img src={logo} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
    : (
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: '50%', background: bg, color: ink }}>
        <MessageCircle style={{ width: iconSize, height: iconSize }} aria-hidden="true" />
      </span>
    ));

  return (
    <div
      className={`flex flex-col ${left ? 'items-start' : 'items-end'} justify-end h-full`}
      style={{ fontFamily: font, fontSize: 15, lineHeight: 1.45, color: '#1f2937' }}
    >
      {mode === 'closed' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: left ? 'flex-start' : 'flex-end' }}>
          <div style={{ position: 'relative', width: 316, maxWidth: '100%', marginBottom: 16, padding: '16px 18px 18px', background: '#fff', borderRadius: 16, boxShadow: '0 0 0 1px rgba(16,24,40,.05), 0 6px 16px -4px rgba(16,24,40,.18)' }}>
            {online.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                <Faces online={online} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#16a34a' }}>{online.length} online</span>
              </div>
            )}
            <div style={{ paddingRight: 20, fontSize: 17, fontWeight: 700, color: '#111827' }}>{title}</div>
            <div style={{ marginTop: 3, fontSize: 15, color: '#4b5563' }}>{CALLOUT_SUBTEXT}</div>
            <span aria-hidden="true" style={{ position: 'absolute', top: 9, right: 9, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 20 }}>×</span>
            <span aria-hidden="true" style={{ position: 'absolute', bottom: -7, [left ? 'left' : 'right']: 24, width: 14, height: 14, background: '#fff', transform: 'rotate(45deg)', boxShadow: '3px 3px 4px -2px rgba(16,24,40,.10)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 62, height: 62, borderRadius: '50%', background: brand, color: ink, boxShadow: `0 6px 16px -2px ${brand}8C` }}>
            <MessageCircle style={{ width: 28, height: 28 }} aria-hidden="true" />
          </div>
        </div>
      ) : (
        <div style={{ width: 420, maxWidth: '100%', background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(16,24,40,.06), 0 8px 20px -6px rgba(16,24,40,.28), 0 2px 6px rgba(16,24,40,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 14px 16px 18px', background: brand, color: ink }}>
            <span style={{ position: 'relative', flex: 'none', width: 42, height: 42 }}>
              {picture(42, 21, 'rgba(255,255,255,.22)')}
              {online.length > 0 && <span style={{ position: 'absolute', top: -1, right: -1, width: 12, height: 12, borderRadius: '50%', background: '#22c55e', border: `2px solid ${brand}` }} />}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 14, opacity: 0.92 }}>
                {online.length > 0 ? <><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />Online now</> : "We'll reply soon"}
              </div>
            </div>
            <X style={{ width: 22, height: 22, marginLeft: 'auto', marginRight: 7, flex: 'none' }} aria-hidden="true" />
          </div>
          <div style={{ display: 'grid', gap: 14, padding: 18 }} aria-hidden="true">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ flex: 'none', overflow: 'hidden', borderRadius: '50%' }}>{picture(32, 16, brand)}</span>
              <div style={{ maxWidth: '82%', padding: '12px 16px', borderRadius: 16, background: '#f3f4f6', fontSize: 16, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{welcome}</div>
            </div>
            {shown.map((key) => (
              <div key={key} style={{ ...inputStyle, minHeight: key === 'message' ? 96 : undefined }}>{fieldPlaceholder(key, fields[key])}</div>
            ))}
            <p style={{ margin: '2px 0 0', fontSize: 12.5, lineHeight: 1.5, color: '#6b7280' }}>{CONSENT_LINE}</p>
            <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: brand, color: ink, fontSize: 16, fontWeight: 600, opacity: 0.45 }}>
              Send Message
            </div>
          </div>
          <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '0 0 13px', marginTop: -4, fontSize: 12.5, color: '#9ca3af' }}>
            <span>Powered by</span>
            <svg viewBox={STASHT_MARK_VIEWBOX} style={{ width: 18, height: 12 }}><path d={STASHT_MARK_PATH} fill="#6C60FF" /></svg>
            <strong style={{ color: '#4b5563', fontWeight: 700 }}>Stasht</strong>
          </div>
        </div>
      )}
    </div>
  );
}
