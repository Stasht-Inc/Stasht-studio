import { ConnectorIcon } from './ConnectorIcon';
import type { ConnectorDef, ConnectorId } from './catalog';

export interface ActiveConnector {
  connector: ConnectorDef;
  status: string; // e.g. "Connected · yourstore.myshopify.com · since Sep 3, 2026"
}

/** One row per connected connector, each with a Manage button that opens its usual modal. */
export function ActiveConnectorsList({
  items,
  onManage,
}: {
  items: ActiveConnector[];
  onManage: (id: ConnectorId) => void;
}) {
  return (
    <ul className="rounded-2xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100 overflow-hidden">
      {items.map(({ connector, status }) => (
        <li key={connector.id} className="flex items-center gap-4 px-5 py-4 flex-wrap">
          <ConnectorIcon connector={connector} />
          <div className="flex-1 min-w-[12rem]">
            <h3 className="text-lg font-bold text-gray-900">{connector.name}</h3>
            <p className="text-sm text-gray-500">{status}</p>
          </div>
          <button
            type="button"
            onClick={() => onManage(connector.id)}
            aria-label={`Manage ${connector.name}`}
            className="px-5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            Manage
          </button>
        </li>
      ))}
    </ul>
  );
}
