import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, ExternalLink, Info, CheckCircle2, Loader2, Unplug, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { dashboardAPI } from '../utils/authUtils';
import { widgetsAPI } from '../services/widgetsAPI';
import type { ContactWidget } from '../services/widgetsAPI';
import { ContactWidgetManager } from '../components/widgets/ContactWidgetManager';
import { CONNECTORS, OFFERED_CONNECTORS, CONNECTORS_COUNT_EVENT } from '../components/connectors/catalog';
import type { ConnectorId } from '../components/connectors/catalog';
import { ConnectorCard } from '../components/connectors/ConnectorCard';
import { ActiveConnectorsList } from '../components/connectors/ActiveConnectorsList';
import type { ActiveConnector } from '../components/connectors/ActiveConnectorsList';
import { AddConnectorModal } from '../components/connectors/AddConnectorModal';
import { useIsStarterPlan } from '../hooks/usePlan';
import { requestUpgrade } from '../utils/planEvents';
import { useProperty } from '../contexts/PropertyContext';

const shopifyOAuthSteps = [
  'Enter your Shopify store domain below',
  'Click "Connect with Shopify" — you\'ll be redirected to Shopify',
  'Log in and approve the requested permissions',
  "You'll be returned here and your products will sync automatically",
];

const shopifyPermissions = [
  'Read products',
  'Read product listings',
  'Read inventory',
  'Read orders',
  'Read customer data',
];

// Normalize whatever the user types into a *.myshopify.com domain.
// Accepts "store", "store.myshopify.com", or a full URL.
function normalizeShopDomain(input: string): string {
  let s = (input || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!s.includes('.')) s = `${s}.myshopify.com`;
  return s;
}

function ShopifyConnectModal({
  onClose,
  isConnected,
  shopDomain,
  connectedAt,
  onDisconnect,
}: {
  onClose: () => void;
  isConnected: boolean;
  shopDomain: string | null;
  connectedAt: string | null;
  onDisconnect: () => void;
}) {
  const [store, setStore] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    const shop = normalizeShopDomain(store);
    if (!shop || !shop.endsWith('.myshopify.com')) {
      toast.error('Enter a valid store domain, e.g. yourstore.myshopify.com');
      return;
    }
    setLoading(true);
    try {
      const res = await dashboardAPI.shopifyGetAuthUrl(shop);
      if (res.success && res.data?.auth_url) {
        window.location.href = res.data.auth_url;
      } else {
        toast.error(res.error || 'Failed to start Shopify authorization');
        setLoading(false);
      }
    } catch {
      toast.error('Failed to connect Shopify');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.shopifyDisconnect();
      if (res.success) {
        toast.success('Shopify disconnected successfully');
        onDisconnect();
        onClose();
      } else {
        toast.error(res.error || 'Failed to disconnect Shopify');
        setLoading(false);
      }
    } catch {
      toast.error('Failed to disconnect Shopify');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: 'linear-gradient(145deg, #95BF47, #5E8E3E)' }}
            >
              <img src="https://cdn.simpleicons.org/shopify/ffffff" alt="Shopify" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isConnected ? 'Shopify Connected' : 'Connect Shopify'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5 leading-snug">
                Sync product images, titles, descriptions, and pricing from your Shopify store
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 pb-2 space-y-5 flex-1">
          {isConnected ? (
            <div className="bg-green-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span className="text-green-700 font-semibold text-sm">Shopify is connected</span>
              </div>
              {shopDomain && <p className="text-green-600 text-sm">Store: {shopDomain}</p>}
              {connectedAt && (
                <p className="text-green-600 text-sm">
                  Connected on {new Date(connectedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Info box */}
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-blue-700 font-semibold text-sm">How it works</span>
                </div>
                <ul className="space-y-1.5">
                  {shopifyOAuthSteps.map((step, i) => (
                    <li key={step} className="text-blue-600 text-sm leading-snug">{i + 1}. {step}</li>
                  ))}
                </ul>
              </div>

              {/* Store domain input */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1.5">
                  Store Domain<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleConnect(); }}
                  placeholder="yourstore.myshopify.com"
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
                />
                <p className="text-xs text-gray-400 mt-1">No API keys needed — just your store domain.</p>

                {/* Where to find your store domain */}
                <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1.5">Where do I find this?</p>
                  <ol className="space-y-1 text-xs text-gray-600 list-decimal list-inside">
                    <li>
                      Log in to your Shopify admin at{' '}
                      <a href="https://admin.shopify.com" target="_blank" rel="noopener noreferrer" className="text-[#6C60FF] hover:underline">admin.shopify.com</a>
                    </li>
                    <li>Look at the address bar — it looks like this:</li>
                  </ol>
                  <div className="mt-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2 font-mono text-[12px] text-gray-500 overflow-x-auto">
                    admin.shopify.com/store/<span className="text-[#6C60FF] font-semibold">yourstore</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5">
                    Take the highlighted part and add <span className="font-mono">.myshopify.com</span> — e.g.{' '}
                    <span className="font-mono text-gray-800">yourstore.myshopify.com</span>.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Permissions */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3 text-base">Permissions & Scopes</h3>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
              {shopifyPermissions.map(perm => (
                <div key={perm} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{perm}</span>
                </div>
              ))}
            </div>
          </div>

          {/* External links */}
          <div className="grid grid-cols-2 gap-3 pb-2">
            <a
              href="https://shopify.dev/docs/api"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Shopify API Portal
            </a>
            <a
              href="https://shopify.dev/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Developer Docs
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            {isConnected ? 'Close' : 'Cancel'}
          </button>
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4" />}
              {loading ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FFF] disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Redirecting...' : 'Connect with Shopify'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const docusignPermissions = [
  'Send envelopes',
  'View envelope status',
  'Download signed documents',
  'Access recipient information',
  'Webhook notifications',
];

function DocuSignConnectModal({
  onClose,
  isConnected,
  connectedAt,
  onDisconnect,
  onConnected,
}: {
  onClose: () => void;
  isConnected: boolean;
  connectedAt: string | null;
  onDisconnect: () => void;
  onConnected: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.docuSignGetAuthUrl();
      if (res.success && res.data?.auth_url) {
        window.location.href = res.data.auth_url;
      } else {
        toast.error('Failed to start DocuSign authorization');
        setLoading(false);
      }
    } catch {
      toast.error('Failed to connect DocuSign');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.docuSignDisconnect();
      if (res.success) {
        toast.success('DocuSign disconnected successfully');
        onDisconnect();
        onClose();
      } else {
        toast.error(res.error || 'Failed to disconnect DocuSign');
        setLoading(false);
      }
    } catch {
      toast.error('Failed to disconnect DocuSign');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden border border-gray-100">
              <img src="/docusign-icon.png" alt="DocuSign" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isConnected ? 'DocuSign Connected' : 'Connect DocuSign'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5 leading-snug">
                Embed signable PDFs with real-time signature tracking and metadata
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 pb-2 space-y-5 flex-1">
          {isConnected ? (
            <div className="bg-green-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span className="text-green-700 font-semibold text-sm">DocuSign is connected</span>
              </div>
              {connectedAt && (
                <p className="text-green-600 text-sm">
                  Connected on {new Date(connectedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-blue-700 font-semibold text-sm">How it works</span>
              </div>
              <ul className="space-y-1.5">
                <li className="text-blue-600 text-sm leading-snug">1. Click "Connect with DocuSign" below</li>
                <li className="text-blue-600 text-sm leading-snug">2. You'll be redirected to DocuSign's login page</li>
                <li className="text-blue-600 text-sm leading-snug">3. Log in with your normal DocuSign account</li>
                <li className="text-blue-600 text-sm leading-snug">4. Click Allow — you'll be returned here automatically</li>
              </ul>
            </div>
          )}

          {/* Permissions */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3 text-base">Permissions & Scopes</h3>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
              {docusignPermissions.map(perm => (
                <div key={perm} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{perm}</span>
                </div>
              ))}
            </div>
          </div>

          {/* External links */}
          <div className="grid grid-cols-2 gap-3 pb-2">
            <a
              href="https://developers.docusign.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              DocuSign Portal
            </a>
            <a
              href="https://developers.docusign.com/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Developer Docs
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            {isConnected ? 'Close' : 'Cancel'}
          </button>
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4" />}
              {loading ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FFF] disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Redirecting...' : 'Connect with DocuSign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const autotraderSteps = [
  'Contact AutoTrader dealer support to request API access',
  'Once approved, log into AutoTrader API Portal',
  'Navigate to API Keys section',
  'Generate a new API Key for production use',
  'Copy your Dealer ID, API Key, and Secret above',
  'Note: API access requires an active AutoTrader dealer account',
];

const autotraderPermissions = [
  'Read vehicle listings',
  'Access vehicle photos',
  'Read VIN details',
  'Access pricing data',
  'Read specifications',
];

function AutoTraderConnectModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden border border-gray-100">
              <img src="/autotrader-icon.png" alt="AutoTrader" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Connect AutoTrader</h2>
              <p className="text-sm text-gray-500 mt-0.5 leading-snug">
                Pull vehicle photos and specs including year, make, model, VIN, mileage, and pricing
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 pb-2 space-y-5 flex-1">
          {/* Info box */}
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="text-blue-700 font-semibold text-sm">Getting Your AutoTrader API Credentials</span>
            </div>
            <ul className="space-y-1.5">
              {autotraderSteps.map(step => (
                <li key={step} className="text-blue-600 text-sm leading-snug">{step}</li>
              ))}
            </ul>
          </div>

          {/* Form */}
          <div>
            <h3 className="font-bold text-gray-900 mb-4 text-base">Enter Your AutoTrader Credentials</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1.5">
                  Dealer ID<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="AT123456"
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
                />
                <p className="text-xs text-gray-400 mt-1">Your AutoTrader dealer account number</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1.5">
                  API Key<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="at_live_abc123xyz..."
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
                />
                <p className="text-xs text-gray-400 mt-1">Request from AutoTrader API Portal</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1.5">
                  API Secret<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="at_secret_def456uvw..."
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
                />
                <p className="text-xs text-gray-400 mt-1">Generated with your API Key</p>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3 text-base">Required Permissions & Scopes</h3>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
              {autotraderPermissions.map(perm => (
                <div key={perm} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{perm}</span>
                </div>
              ))}
            </div>
          </div>

          {/* External links */}
          <div className="grid grid-cols-2 gap-3 pb-2">
            <a
              href="https://www.autotrader.ca/dealer/signup/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              AutoTrader API Portal
            </a>
            <a
              href="https://go.trader.ca/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Developer Docs
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button className="flex-1 py-3 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FFF] text-white font-semibold text-sm transition-colors">
            Connect AutoTrader
          </button>
        </div>
      </div>
    </div>
  );
}

const connectorById = (id: ConnectorId) => CONNECTORS.find((c) => c.id === id)!;

function since(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `since ${d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function MarketplacePage() {
  const [activeModal, setActiveModal] = useState<ConnectorId | 'add' | null>(null);
  const [docusignConnected, setDocusignConnected] = useState(false);
  const [docusignConnectedAt, setDocusignConnectedAt] = useState<string | null>(null);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [shopifyShopDomain, setShopifyShopDomain] = useState<string | null>(null);
  const [shopifyConnectedAt, setShopifyConnectedAt] = useState<string | null>(null);
  const [contactWidgets, setContactWidgets] = useState<ContactWidget[]>([]);
  // Until all three status checks settle we can't tell whether to show the catalog or the active list.
  const [loaded, setLoaded] = useState(false);

  // Property view (Chris, 2026-09-28): only the property's Contact Us widget is offered there.
  const { viewType, currentProperty } = useProperty();
  const propertyId = viewType === 'property' && currentProperty ? currentProperty.id : null;
  const [propertyError, setPropertyError] = useState('');

  useEffect(() => {
    // Handle OAuth callback result from URL params
    const params = new URLSearchParams(window.location.search);
    const docusignParam = params.get('docusign');
    if (docusignParam === 'connected') {
      toast.success('DocuSign connected successfully');
      setActiveModal('docusign');
      const url = new URL(window.location.href);
      url.searchParams.delete('docusign');
      window.history.replaceState({}, '', url.toString());
    } else if (docusignParam === 'error') {
      const reason = params.get('reason') || 'unknown_error';
      toast.error(`DocuSign connection failed: ${reason.replace(/_/g, ' ')}`);
      const url = new URL(window.location.href);
      url.searchParams.delete('docusign');
      url.searchParams.delete('reason');
      window.history.replaceState({}, '', url.toString());
    }

    // Handle Shopify OAuth callback result from URL params
    const shopifyParam = params.get('shopify');
    if (shopifyParam === 'connected') {
      toast.success('Shopify connected successfully');
      setActiveModal('shopify');
      const url = new URL(window.location.href);
      url.searchParams.delete('shopify');
      window.history.replaceState({}, '', url.toString());
    } else if (shopifyParam === 'error') {
      const reason = params.get('reason') || 'unknown_error';
      toast.error(`Shopify connection failed: ${reason.replace(/_/g, ' ')}`);
      const url = new URL(window.location.href);
      url.searchParams.delete('shopify');
      url.searchParams.delete('reason');
      window.history.replaceState({}, '', url.toString());
    }

    if (propertyId) {
      widgetsAPI.list({ propertyId })
        .then(res => {
          if (res.ok && Array.isArray(res.data)) setContactWidgets(res.data);
          else setPropertyError(res.error || "Only the property's owner and admins can manage its widgets.");
        })
        .catch(() => {})
        .finally(() => setLoaded(true));
      return;
    }

    const docusign = dashboardAPI.docuSignGetStatus()
      .then(res => {
        if (res.success && res.data) {
          setDocusignConnected(res.data.connected);
          setDocusignConnectedAt(res.data.connected_at || null);
        }
      })
      .catch(() => {});

    const shopify = dashboardAPI.shopifyGetStatus()
      .then(res => {
        if (res.success && res.data) {
          setShopifyConnected(res.data.connected);
          setShopifyShopDomain(res.data.shop_domain || null);
          setShopifyConnectedAt(res.data.connected_at || null);
        }
      })
      .catch(() => {});

    const widgets = widgetsAPI.list()
      .then(res => {
        if (res.ok && Array.isArray(res.data)) setContactWidgets(res.data);
      })
      .catch(() => {});

    Promise.all([docusign, shopify, widgets]).then(() => setLoaded(true));
  }, [propertyId]);

  const activeConnectors = useMemo<ActiveConnector[]>(() => {
    const items: ActiveConnector[] = [];
    if (shopifyConnected) {
      items.push({
        connector: connectorById('shopify'),
        status: ['Connected', shopifyShopDomain, since(shopifyConnectedAt)].filter(Boolean).join(' · '),
      });
    }
    if (docusignConnected) {
      items.push({
        connector: connectorById('docusign'),
        status: ['Connected', since(docusignConnectedAt)].filter(Boolean).join(' · '),
      });
    }
    if (contactWidgets.length > 0) {
      const live = contactWidgets.filter((w) => w.status === 'live').length;
      const leads = contactWidgets.reduce((n, w) => n + (w.leads_count ?? 0), 0);
      const sites = new Set(contactWidgets.flatMap((w) => (w.installs || []).map((i) => i.host))).size;
      items.push({
        connector: connectorById('contact-widget'),
        status: [
          plural(contactWidgets.length, 'widget'),
          `${live} live`,
          sites > 0 ? `on ${plural(sites, 'website')}` : 'not installed yet',
          plural(leads, 'lead'),
        ].join(' · '),
      });
    }
    return items;
  }, [shopifyConnected, shopifyShopDomain, shopifyConnectedAt, docusignConnected, docusignConnectedAt, contactWidgets]);

  const offered = useMemo(
    () => (propertyId ? OFFERED_CONNECTORS.filter((c) => c.id === 'contact-widget') : OFFERED_CONNECTORS),
    [propertyId],
  );
  const available = useMemo(
    () => offered.filter((c) => !activeConnectors.some((a) => a.connector.id === c.id)),
    [offered, activeConnectors],
  );

  // Keep the sidebar's Connectors badge in step with what this page shows.
  useEffect(() => {
    if (!loaded) return;
    window.dispatchEvent(new CustomEvent(CONNECTORS_COUNT_EVENT, { detail: { count: activeConnectors.length } }));
  }, [loaded, activeConnectors.length]);

  const closeModal = useCallback(() => setActiveModal(null), []);
  const hasActive = activeConnectors.length > 0;

  // Connectors are shown on every plan, but on the free (Starter) plan using one opens the
  // upgrade plans instead (Chris, 2026-09-28). The API refuses free accounts as well.
  const { isStarter } = useIsStarterPlan();
  const openConnector = useCallback((id: ConnectorId | 'add') => {
    if (isStarter) requestUpgrade();
    else setActiveModal(id);
  }, [isStarter]);

  return (
    <div className="p-6 sm:p-10 max-w-7xl">
      {/* Header */}
      <div className="mb-10 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Connectors</h1>
          <p className="text-gray-500 mt-2 text-base">Connect your favorite services and extend Stasht functionality</p>
        </div>
        {loaded && hasActive && available.length > 0 && (
          <button
            type="button"
            onClick={() => openConnector('add')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FFF] text-white text-base font-semibold transition-colors"
          >
            <Plus className="w-5 h-5" /> Add connector
          </button>
        )}
      </div>

      {!loaded ? (
        <div className="space-y-3" role="status" aria-label="Loading connectors">
          {[0, 1].map((i) => <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : propertyError ? (
        <p className="text-base text-gray-600">{propertyError}</p>
      ) : hasActive ? (
        <section aria-labelledby="your-connectors-heading">
          <h2 id="your-connectors-heading" className="text-lg font-bold text-gray-900 mb-4">Your connectors</h2>
          <ActiveConnectorsList items={activeConnectors} onManage={openConnector} disabled={isStarter} />
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {offered.map((connector) => (
            <ConnectorCard key={connector.id} connector={connector} onSelect={() => openConnector(connector.id)} />
          ))}
        </div>
      )}

      {/* "+ Add connector" pop-up */}
      {activeModal === 'add' && (
        <AddConnectorModal available={available} onSelect={setActiveModal} onClose={closeModal} />
      )}

      {/* Shopify Connect Modal */}
      {activeModal === 'shopify' && (
        <ShopifyConnectModal
          onClose={closeModal}
          isConnected={shopifyConnected}
          shopDomain={shopifyShopDomain}
          connectedAt={shopifyConnectedAt}
          onDisconnect={() => {
            setShopifyConnected(false);
            setShopifyShopDomain(null);
            setShopifyConnectedAt(null);
          }}
        />
      )}

      {/* DocuSign Connect Modal */}
      {activeModal === 'docusign' && (
        <DocuSignConnectModal
          onClose={closeModal}
          isConnected={docusignConnected}
          connectedAt={docusignConnectedAt}
          onConnected={() => {
            setDocusignConnected(true);
            setDocusignConnectedAt(new Date().toISOString());
          }}
          onDisconnect={() => {
            setDocusignConnected(false);
            setDocusignConnectedAt(null);
          }}
        />
      )}

      {/* Contact Us Widget manager */}
      {activeModal === 'contact-widget' && (
        <ContactWidgetManager
          onClose={closeModal}
          onWidgetsChange={setContactWidgets}
          propertyId={propertyId ?? undefined}
          propertyName={currentProperty?.name}
        />
      )}

      {/* AutoTrader Connect Modal */}
      {activeModal === 'autotrader' && (
        <AutoTraderConnectModal onClose={closeModal} />
      )}
    </div>
  );
}
