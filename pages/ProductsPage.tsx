// pages/ProductsPage.tsx — Products (spec "Products page in Studio"; plan 2026-11-09-products-m1-m2 Tasks 12–14).
import { useEffect } from 'react';
import { Package } from 'lucide-react';
import { useProperty } from '../contexts/PropertyContext';
import { useProductsStatus } from '../hooks/useProductsStatus';
import { productsGate, UPGRADE_LINE } from '../utils/products';
import { requestUpgrade } from '../utils/planEvents';
import { BUTTON_PRIMARY } from '../components/newsletters/lib/ui';

export default function ProductsPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { status, loading } = useProductsStatus();
  const gate = productsGate(status);
  const { viewType } = useProperty();

  // Not available for this account / view (or the status can't be read): leave rather than sit on a dead page.
  useEffect(() => {
    if (!loading && gate === 'hidden') onNavigate(viewType === 'property' ? 'memories' : 'dashboard');
  }, [loading, gate, viewType, onNavigate]);

  return (
    <div data-testid="products-page" className="flex min-h-[calc(100dvh-5rem)] flex-col">
      <div className="px-4 pt-5 md:px-6 md:pt-6">
        <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
      </div>
      {loading && !status ? (
        <p className="px-4 py-10 text-sm text-gray-500 md:px-6">Loading products…</p>
      ) : gate === 'upgrade' ? (
        <div className="mx-4 mt-6 max-w-xl rounded-xl border border-gray-200 bg-white p-6 md:mx-6">
          <Package className="h-8 w-8 text-[#6C60FF]" aria-hidden="true" />
          <p className="mt-3 text-base font-semibold text-gray-900">{UPGRADE_LINE}</p>
          <p className="mt-1 text-sm text-gray-600">Upgrade your plan to add products, import them from your website and share them.</p>
          <button type="button" className={`${BUTTON_PRIMARY} mt-4`} onClick={() => requestUpgrade(`${UPGRADE_LINE} Upgrade your plan to use them.`)}>See plans</button>
        </div>
      ) : gate === 'hidden' ? (
        <p className="px-4 py-10 text-sm text-gray-500 md:px-6">Products isn't available on your account yet.</p>
      ) : (
        <ProductsReady onNavigate={onNavigate} />
      )}
    </div>
  );
}

// Task 13 replaces this with the grid.
function ProductsReady(_props: { onNavigate: (page: string) => void }) {
  return <div className="px-4 py-4 md:px-6" />;
}
