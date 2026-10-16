import { Check } from 'lucide-react';
import { ConnectorIcon } from './ConnectorIcon';
import type { ConnectorCardOverride, ConnectorDef } from './catalog';

const BADGE_TONES = {
  green: { box: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  amber: { box: 'bg-yellow-50 text-yellow-800', dot: 'bg-yellow-500' },
  gray: { box: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
} as const;

/**
 * Catalog card on the Connectors page. The grid is always shown (Chris, 2026-10-05); a connected
 * card carries a "Connected" badge and its status line, and its button reads Manage. `disabled`
 * (free plan, e.g. after a downgrade): a connected card says it's off and the button reads Upgrade.
 * `override` (the Website Catalogue, whose state is richer): its own badge, line and button, and a thin
 * progress bar under the line while its import runs.
 */
export function ConnectorCard({
  connector,
  onSelect,
  status,
  disabled = false,
  override,
}: {
  connector: ConnectorDef;
  onSelect: () => void;
  /** Set when connected, e.g. "Connected · yourstore.myshopify.com · since Sep 3, 2026". */
  status?: string;
  disabled?: boolean;
  override?: ConnectorCardOverride;
}) {
  const connected = status !== undefined;
  const badge = override
    ? override.badge
    : connected
      ? { label: disabled ? 'Disabled' : 'Connected', tone: disabled ? ('gray' as const) : ('green' as const) }
      : undefined;
  const line = override
    ? override.line
    : connected
      ? (disabled ? 'Disabled on the Starter plan. Upgrade to use it again.' : status)
      : undefined;
  const label = override ? override.actionLabel : connected ? (disabled ? 'Upgrade' : 'Manage') : 'Connect';
  const outlined = override ? override.outlined : connected && !disabled;
  const tone = badge ? BADGE_TONES[badge.tone] : null;

  return (
    <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {badge && tone && (
        <span className={`absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${tone.box}`}>
          <span className={`w-2 h-2 rounded-full ${tone.dot}`} aria-hidden="true" />
          {badge.label}
        </span>
      )}

      {/* Logo banner */}
      <div className="h-44 bg-white flex items-center justify-center border-b border-gray-100 px-8">
        {connector.bannerLogo ? (
          <img
            src={connector.bannerLogo}
            alt={connector.name}
            className={`max-w-full object-contain ${connector.id === 'autotrader' ? 'max-h-32' : 'max-h-20'}`}
          />
        ) : (
          <ConnectorIcon connector={connector} size="lg" />
        )}
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center gap-4 mb-4">
          <ConnectorIcon connector={connector} />
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-gray-900">{connector.name}</h3>
            <p className="text-sm text-gray-500">{connector.category}</p>
          </div>
        </div>

        <p className="text-base text-gray-600 leading-relaxed mb-5">{connector.description}</p>

        <ul className="space-y-3 mb-6 flex-1">
          {connector.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2.5 text-base text-gray-700">
              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>

        {line && <p className="text-sm text-gray-500 mb-3 break-words">{line}</p>}
        {override?.progress !== undefined && (
          <div
            className="w-full bg-[#6C60FF]/20 rounded-full h-1.5 overflow-hidden mb-3"
            role="progressbar"
            aria-label={`${connector.name} import progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={override.progress ?? undefined}
          >
            {override.progress === null ? (
              <div className="bg-[#6C60FF] h-1.5 w-1/3 rounded-full animate-pulse" />
            ) : (
              <div className="bg-[#6C60FF] h-1.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${override.progress}%` }} />
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onSelect}
          aria-label={`${label} ${connector.name}`}
          className={`w-full py-3 rounded-xl text-base font-semibold transition-colors ${
            outlined
              ? 'border border-[#6C60FF] text-[#6C60FF] bg-white hover:bg-[#F3F2FF]'
              : 'bg-[#6C60FF] hover:bg-[#5A4FFF] text-white'
          }`}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
