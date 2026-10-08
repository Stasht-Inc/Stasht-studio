import { Check } from 'lucide-react';
import { ConnectorIcon } from './ConnectorIcon';
import type { ConnectorDef } from './catalog';

/**
 * Catalog card on the Connectors page. The grid is always shown (Chris, 2026-10-05); a connected
 * card carries a "Connected" badge and its status line, and its button reads Manage. `disabled`
 * (free plan, e.g. after a downgrade): a connected card says it's off and the button reads Upgrade.
 */
export function ConnectorCard({
  connector,
  onSelect,
  status,
  disabled = false,
}: {
  connector: ConnectorDef;
  onSelect: () => void;
  /** Set when connected, e.g. "Connected · yourstore.myshopify.com · since Sep 3, 2026". */
  status?: string;
  disabled?: boolean;
}) {
  const connected = status !== undefined;
  const label = connected ? (disabled ? 'Upgrade' : 'Manage') : 'Connect';

  return (
    <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {connected && (
        <span
          className={`absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
            disabled ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${disabled ? 'bg-gray-400' : 'bg-green-500'}`} aria-hidden="true" />
          {disabled ? 'Disabled' : 'Connected'}
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

        {connected && (
          <p className="text-sm text-gray-500 mb-3">
            {disabled ? 'Disabled on the Starter plan. Upgrade to use it again.' : status}
          </p>
        )}

        <button
          type="button"
          onClick={onSelect}
          aria-label={`${label} ${connector.name}`}
          className={`w-full py-3 rounded-xl text-base font-semibold transition-colors ${
            connected && !disabled
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
