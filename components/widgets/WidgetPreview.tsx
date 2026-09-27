import { MessageCircle } from 'lucide-react';
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
}

// Mirrors public/widget-embed.html + widget-embed.js markup and styles (launcher pill, 360px panel,
// header in brand colour, the shown form fields, Send). Static: nothing here submits.
const font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

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
                {logo && (
                  <img
                    src={logo}
                    alt=""
                    style={{ height: 26, borderRadius: 4, background: '#fff', padding: 2 }}
                  />
                )}
                {agent && <span>{agent}</span>}
              </div>
            )}
            <h2 style={{ margin: '0 32px 6px 0', fontSize: 17, fontWeight: 700 }}>{callout}</h2>
            {welcome && <p style={{ margin: 0, fontSize: 13, opacity: 0.95, whiteSpace: 'pre-wrap' }}>{welcome}</p>}
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
                  {fieldDisplayLabel(key, fields[key])}
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
