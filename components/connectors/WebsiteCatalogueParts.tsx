import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, Globe, ImageOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { copyText, safeHttpsUrl } from '../widgets/widgetHelpers';
import { WEBSITE_CATALOG_COLOR } from '../../utils/categoryColorManager';
import type { CatalogueBlockedHelp, CatalogueDomain } from '../../services/catalogueAPI';

// Shared pieces of the Website Catalogue connect and manage dialogs, in the look of the Shopify /
// DocuSign connect modals on the Connectors page (spec 2026-09-30 §2 #11: no designs, reuse Studio's).

export const BUTTON_PRIMARY =
  'flex-1 py-3 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FFF] disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2';
export const BUTTON_SECONDARY =
  'flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2';
export const BUTTON_DANGER =
  'flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2';
export const BUTTON_OUTLINED =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#6C60FF] text-[#6C60FF] bg-white hover:bg-[#F3F2FF] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-colors';

/** The connect-modal frame: header with the catalogue's globe tile, a scrolling body and a footer row. */
export function CatalogueModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: WEBSITE_CATALOG_COLOR }}>
              <Globe className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500 mt-0.5 leading-snug break-words">{subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-4 space-y-5 flex-1">{children}</div>
        <div className="flex flex-wrap gap-3 px-6 py-4 border-t border-gray-100">{footer}</div>
      </div>
    </div>
  );
}

const NOTICE_TONES = {
  info: 'bg-blue-50 text-blue-700',
  warning: 'border border-yellow-200 bg-yellow-50 text-yellow-800',
  neutral: 'border border-gray-200 bg-gray-50 text-gray-700',
  error: 'border border-red-200 bg-red-50 text-red-700',
} as const;

/** A tinted message box (the Shopify modal's info box and the Refresh banner's yellow). */
export function Notice({ tone, children }: { tone: keyof typeof NOTICE_TONES; children: ReactNode }) {
  return (
    <div role={tone === 'warning' || tone === 'error' ? 'alert' : 'status'} className={`rounded-xl p-4 text-sm leading-relaxed ${NOTICE_TONES[tone]}`}>
      {children}
    </div>
  );
}

/** A value in a monospace box with a Copy button (ContactWidgetManager's install-code pattern). */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyText(value)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Could not copy. Select the text and copy it manually.');
    }
  };

  return (
    <div>
      <p className="text-sm font-medium text-gray-800 mb-1.5">{label}</p>
      <div className="flex items-start gap-2">
        <pre className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg px-3 py-2 font-mono text-xs text-gray-800 whitespace-pre-wrap break-all select-all">
          {value}
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

/** The ways to prove ownership (spec §6.1); the widget option only when the account has a Contact Us widget. */
export function VerificationMethods({ domain }: { domain: CatalogueDomain }) {
  const options: Array<{ key: string; title: string; body: ReactNode }> = [];
  if (domain.has_widget) {
    options.push({
      key: 'widget',
      title: 'your Contact Us widget',
      body: <p className="text-sm text-gray-600 mt-1">If your Stasht Contact Us widget is already on your homepage, there's nothing to add.</p>,
    });
  }
  options.push({
    key: 'meta',
    title: 'a meta tag',
    body: (
      <>
        <p className="text-sm text-gray-600 mt-1">
          Paste this tag inside the &lt;head&gt; of your homepage on {domain.host}. Most website builders have a "header code" or "custom code" setting for it.
        </p>
        <div className="mt-3">
          <CopyField label="Meta tag" value={domain.meta_tag} />
        </div>
      </>
    ),
  });
  options.push({
    key: 'dns',
    title: 'a DNS TXT record',
    body: (
      <>
        <p className="text-sm text-gray-600 mt-1">
          Add a TXT record for {domain.dns_name} where you manage your domain. This works even if your website blocks robots. DNS changes can take up to an hour.
        </p>
        <div className="mt-3 space-y-3">
          <CopyField label="Name" value={domain.dns_name} />
          <CopyField label="Value" value={domain.dns_value} />
        </div>
        <p className="text-xs text-gray-500 mt-2">Type: TXT. Some providers want only the part of the name before your domain, or @ for the domain itself.</p>
      </>
    ),
  });

  return (
    <div className="space-y-4">
      {options.map((option, index) => (
        <section key={option.key} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-bold text-gray-900">Option {index + 1}: {option.title}</h3>
          {option.body}
        </section>
      ))}
    </div>
  );
}

/** What the owner's IT team needs to let our server in (spec §8.2 "Blocked"). */
export function BlockedHelp({ blocked }: { blocked: CatalogueBlockedHelp }) {
  return (
    <div className="space-y-3">
      <CopyField label="Our server's IP address" value={blocked.ip} />
      <CopyField label="Our user agent" value={blocked.user_agent} />
      <CopyField label="Note for your IT team" value={blocked.it_note} />
    </div>
  );
}

/**
 * A preview photo. These are the website's own https URLs (nothing is copied before Connect), so it is a plain
 * <img> that sends no referrer, and a neutral tile stands in when there is no usable URL or it fails to load.
 */
export function PreviewImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const safe = safeHttpsUrl(src);

  if (!safe || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400" role="img" aria-label={`No photo available for ${alt}`}>
        <ImageOff className="w-6 h-6" aria-hidden="true" />
      </div>
    );
  }
  return <img src={safe} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="w-full h-full object-cover" />;
}
