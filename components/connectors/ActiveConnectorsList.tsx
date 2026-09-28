import { ConnectorIcon } from './ConnectorIcon';
import type { ConnectorDef, ConnectorId } from './catalog';

export interface ActiveConnector {
  connector: ConnectorDef;
  status: string; // e.g. "Connected · yourstore.myshopify.com · since Sep 3, 2026"
}

/**
 * One row per connected connector, each with a Manage button that opens its usual modal.
 * `disabled` (the account is on the free plan, e.g. after a downgrade): rows are greyed out,
 * say they're off, and the button reads Upgrade instead (Chris, 2026-09-28).
 */
export function ActiveConnectorsList({
  items,
  onManage,
  disabled = false,
}: {
  items: ActiveConnector[];
  onManage: (id: ConnectorId) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="rounded-2xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100 overflow-hidden">
      {items.map(({ connector, status }) => (
        <li key={connector.id} className={`flex items-center gap-4 px-5 py-4 flex-wrap ${disabled ? 'bg-gray-50' : ''}`}>
          <span className={disabled ? 'opacity-50 grayscale' : undefined}>
            <ConnectorIcon connector={connector} />
          </span>
          <div className="flex-1 min-w-[12rem]">
            <h3 className={`text-lg font-bold ${disabled ? 'text-gray-500' : 'text-gray-900'}`}>{connector.name}</h3>
            <p className="text-sm text-gray-500">
              {disabled ? 'Disabled on the Starter plan. Upgrade to use it again.' : status}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onManage(connector.id)}
            aria-label={disabled ? `Upgrade to use ${connector.name}` : `Manage ${connector.name}`}
            className="px-5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            {disabled ? 'Upgrade' : 'Manage'}
          </button>
        </li>
      ))}
    </ul>
  );
}
