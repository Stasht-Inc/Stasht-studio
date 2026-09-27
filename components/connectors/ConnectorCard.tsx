import { Check } from 'lucide-react';
import { ConnectorIcon } from './ConnectorIcon';
import type { ConnectorDef } from './catalog';

/** Full catalog card, shown on the Connectors page before anything is connected. */
export function ConnectorCard({ connector, onSelect }: { connector: ConnectorDef; onSelect: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
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

        <button
          type="button"
          onClick={onSelect}
          className="w-full py-3 rounded-xl text-base font-semibold transition-colors bg-[#6C60FF] hover:bg-[#5A4FFF] text-white"
        >
          Connect
        </button>
      </div>
    </div>
  );
}
