import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { ConnectorIcon } from './ConnectorIcon';
import { setupLabel } from './catalog';
import type { ConnectorDef, ConnectorId } from './catalog';

/** "+ Add connector" pop-up: compact cards for the connectors that aren't set up yet. */
export function AddConnectorModal({
  available,
  onSelect,
  onClose,
}: {
  available: ConnectorDef[];
  onSelect: (id: ConnectorId) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-gray-900">Add a connector</h2>
            <p className="text-sm text-gray-500 mt-0.5">Connect another service to Stasht.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="overflow-y-auto px-6 pb-6 space-y-3">
          {available.map((connector) => (
            <li key={connector.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-4">
                <ConnectorIcon connector={connector} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900">{connector.name}</h3>
                  <p className="text-sm text-gray-500">{connector.category}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(connector.id)}
                  className="px-4 py-2 rounded-lg bg-[#6C60FF] hover:bg-[#5A4FFF] text-white text-sm font-semibold transition-colors flex-shrink-0"
                >
                  {setupLabel(connector.id)}
                </button>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mt-3 line-clamp-2">{connector.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
