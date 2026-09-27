import { MessageCircle, UserRound } from 'lucide-react';
import type { CSSProperties } from 'react';
import {
  DEFAULT_CALLOUT, FORM_FIELD_KEYS, MESSAGE_MAX, consentLine, contrastInk, fieldDisplayLabel, resolveFormFields, safeColor, safeHttpsUrl,
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
  // Sample "who's online" row (the embed shows the real team from the server).
  online?: { name: string; initials: string; color: string; avatarUrl?: string | null }[];
}

// Mirrors public/widget-embed.html + widget-embed.js markup and styles (launcher pill, 360px panel,
// header in brand colour, the shown form fields, Send). Static: nothing here submits.
const font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// Same wording as widget-core.js onlineLabel().
function onlineText(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is online`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are online`;
}

const labelStyle: CSSProperties = { display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: '#3d4257' };
const inputStyle: CSSProperties = {
  font: 'inherit', padding: '10px 12px', border: '1px solid #c9cfdd', borderRadius: 10,
  width: '100%', color: '#1b2030', background: '#fff', boxSizing: 'border-box',
};

export function WidgetPreview({ values, mode }: { values: WidgetPreviewValues; mode: 'closed' | 'open' }) {
  const brand = safeColor(values.primaryColor);
  const ink = contrastInk(brand);
  const logo = safeHttpsUrl(values.logoUrl);
  const callout = values.calloutText.trim() || DEFAULT_CALLOUT;
  const agent = values.agentName.trim();
  const welcome = values.welcomeSubtext.trim();
  const alignEnd = values.position === 'bottom-right';
  const fields = values.formFields || resolveFormFields(null);
  const shown = FORM_FIELD_KEYS.filter((k) => fields[k].show);
  const online = (values.online || []).slice(0, 3);

  return (
    <div
      className={`flex flex-col ${alignEnd ? 'items-end' : 'items-start'} justify-end h-full`}
      style={{ fontFamily: font, fontSize: 14, lineHeight: 1.45, color: '#1b2030' }}
    >
      {mode === 'closed' ? (
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderRadius: 999,
            background: brand, color: ink, fontWeight: 600, whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px -2px rgba(16,24,40,.30), 0 1px 3px rgba(16,24,40,.12)', maxWidth: '100%',
          }}
        >
          <MessageCircle style={{ width: 22, height: 22, flex: 'none' }} aria-hidden="true" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{callout}</span>
        </div>
      ) : (
        <div
          style={{
            width: 360, maxWidth: '100%', background: '#fff', borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 0 0 1px rgba(16,24,40,.06), 0 8px 20px -6px rgba(16,24,40,.28), 0 2px 6px rgba(16,24,40,.08)',
          }}
        >
          <div style={{ background: brand, color: ink, padding: '18px 20px 16px', position: 'relative' }}>
            {(agent || logo) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 600, fontSize: 13 }}>
                {logo ? (
                  <img src={logo} alt="" style={{ flex: 'none', width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
                ) : (
                  <span style={{ flex: 'none', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.22)', color: ink }}>
                    <UserRound style={{ width: 18, height: 18 }} aria-hidden="true" />
                  </span>
                )}
                {agent && <span>{agent}</span>}
              </div>
            )}
            <h2 style={{ margin: '0 32px 6px 0', fontSize: 17, fontWeight: 700 }}>{callout}</h2>
            {welcome && <p style={{ margin: 0, fontSize: 13, opacity: 0.95, whiteSpace: 'pre-wrap' }}>{welcome}</p>}
            {online.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 13, fontWeight: 600 }}>
                <span style={{ display: 'flex' }} aria-hidden="true">
                  {online.map((m, i) => {
                    const photo = safeHttpsUrl(m.avatarUrl ?? '');
                    const color = safeColor(m.color, '#6C60FF');
                    return (
                      <span
                        key={`${m.name}-${i}`}
                        style={{ position: 'relative', zIndex: 3 - i, width: 30, height: 30, marginLeft: i === 0 ? 0 : -8, borderRadius: '50%', border: `2px solid ${brand}`, background: '#fff' }}
                      >
                        {photo ? (
                          <img src={photo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: '50%', background: color, color: contrastInk(color), fontSize: 11, fontWeight: 700 }}>
                            {m.initials}
                          </span>
                        )}
                        <span style={{ position: 'absolute', right: -3, bottom: -3, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: `2px solid ${brand}` }} />
                      </span>
                    );
                  })}
                </span>
                <span>{onlineText(online.map((m) => m.name))}</span>
              </div>
            )}
            <span
              aria-hidden="true"
              style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, lineHeight: 1 }}
            >
              ×
            </span>
          </div>
          <div style={{ padding: '16px 20px 18px', display: 'grid', gap: 10 }} aria-hidden="true">
            {shown.map((key) => (
              <div key={key} style={{ display: 'grid', gap: 10 }}>
                <div style={labelStyle}>
                  <span>
                    {fieldDisplayLabel(key, fields[key])}
                    {fields[key].required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                  </span>
                  <div style={{ ...inputStyle, minHeight: key === 'message' ? 84 : 40 }} />
                </div>
                {key === 'message' && <div style={{ textAlign: 'right', fontSize: 11, color: '#6b7288' }}>0/{MESSAGE_MAX}</div>}
              </div>
            ))}
            <div
              style={{
                padding: '13px 16px', borderRadius: 999, background: brand, color: ink,
                fontWeight: 700, textAlign: 'center',
              }}
            >
              Send Message
            </div>
            <p style={{ fontSize: 11, color: '#6b7288', margin: '2px 0 0' }}>{consentLine(fields)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
