import { useState, useEffect } from 'react';
import { Check, X, ExternalLink, Info, CheckCircle2, Loader2, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { dashboardAPI } from '../utils/authUtils';

interface Widget {
  id: string;
  name: string;
  category: string;
  description: string;
  features: string[];
  bannerLogo?: string;
  iconImage?: string;
  iconFill?: boolean;
}

const widgets: Widget[] = [
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'E-commerce Platform',
    description: 'Sync your Shopify product images and customer photos directly to Stasht. Organize product photography and create stunning photobooks from your e-commerce content.',
    features: ['Auto-sync product images', 'Organize by collection', 'Create product catalogs'],
    bannerLogo: 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Shopify_logo_2018.svg',
    iconImage: 'https://cdn.simpleicons.org/shopify/ffffff',
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    category: 'Digital Signatures',
    description: 'Add documents to your campaigns that can be opened and signed with DocuSign. Perfect for important agreements, contracts, and legal documents that are part of your campaign.',
    features: ['Attach signable documents', 'Track signature status', 'Secure document storage'],
    bannerLogo: '/docusign-logo.png',
    iconImage: '/docusign-icon.png',
    iconFill: true,
  },
  {
    id: 'autotrader',
    name: 'AutoTrader',
    category: 'Vehicle Marketplace',
    description: 'Create campaigns from your vehicle listings and automotive adventures. Track your car collection journey, document restoration projects, and share memorable road trips with rich photo galleries.',
    features: ['Import vehicle photos', 'Import specifications', 'Create product catalogs'],
    bannerLogo: '/autotrader-logo.png',
    iconImage: '/autotrader-icon.png',
    iconFill: true,
  },
];

const brandColors: Record<string, string> = {
  shopify: 'linear-gradient(145deg, #95BF47, #5E8E3E)',
  docusign: '#ffffff',
  autotrader: '#ffffff',
};

const brandInitials: Record<string, string> = {
  shopify: 'S',
  docusign: 'D',
  autotrader: 'AT',
};

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

export default function MarketplacePage() {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [docusignConnected, setDocusignConnected] = useState(false);
  const [docusignConnectedAt, setDocusignConnectedAt] = useState<string | null>(null);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [shopifyShopDomain, setShopifyShopDomain] = useState<string | null>(null);
  const [shopifyConnectedAt, setShopifyConnectedAt] = useState<string | null>(null);

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

    // Fetch DocuSign connection status
    dashboardAPI.docuSignGetStatus()
      .then(res => {
        if (res.success && res.data) {
          setDocusignConnected(res.data.connected);
          setDocusignConnectedAt(res.data.connected_at || null);
        }
      })
      .catch(() => {});

    // Fetch Shopify connection status
    dashboardAPI.shopifyGetStatus()
      .then(res => {
        if (res.success && res.data) {
          setShopifyConnected(res.data.connected);
          setShopifyShopDomain(res.data.shop_domain || null);
          setShopifyConnectedAt(res.data.connected_at || null);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="p-6 sm:p-10 max-w-7xl">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Connectors</h1>
        <p className="text-gray-500 mt-2 text-base">Connect your favorite services and extend Stasht functionality</p>
      </div>

      {/* Widget Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* AutoTrader hidden from the Connectors grid (Deepak, 2026-09-22) — the
            connect flow/modal below is left in place, just not offered as a card. */}
        {widgets.filter(widget => widget.id !== 'autotrader').map(widget => (
          <div key={widget.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            {/* Logo Banner */}
            <div className="h-44 bg-white flex items-center justify-center border-b border-gray-100 px-8">
              {widget.bannerLogo ? (
                <img
                  src={widget.bannerLogo}
                  alt={widget.name}
                  className={`max-w-full object-contain ${widget.id === 'autotrader' ? 'max-h-32' : 'max-h-20'}`}
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold"
                  style={{ background: brandColors[widget.id] }}
                >
                  {brandInitials[widget.id]}
                </div>
              )}
            </div>

            {/* Card Body */}
            <div className="p-6 flex flex-col flex-1">
              {/* Name + Category + Connected badge */}
              <div className="flex items-center gap-4 mb-4">
                {widget.iconImage ? (
                  <div
                    className={`w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden border border-gray-100 ${widget.iconFill ? '' : 'flex items-center justify-center'}`}
                    style={{ background: brandColors[widget.id] }}
                  >
                    <img
                      src={widget.iconImage}
                      alt={widget.name}
                      className={widget.iconFill ? 'w-full h-full object-cover' : 'w-8 h-8 object-contain'}
                    />
                  </div>
                ) : (
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0"
                    style={{ background: brandColors[widget.id] }}
                  >
                    {brandInitials[widget.id]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-gray-900">{widget.name}</h3>
                    {((widget.id === 'docusign' && docusignConnected) || (widget.id === 'shopify' && shopifyConnected)) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                        <Check className="w-3 h-3" /> Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{widget.category}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-base text-gray-600 leading-relaxed mb-5">{widget.description}</p>

              {/* Features */}
              <ul className="space-y-3 mb-6 flex-1">
                {widget.features.map(feature => (
                  <li key={feature} className="flex items-center gap-2.5 text-base text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Button */}
              {(() => {
                const connected = (widget.id === 'docusign' && docusignConnected) || (widget.id === 'shopify' && shopifyConnected);
                return (
                  <button
                    onClick={() => setActiveModal(widget.id)}
                    className={`w-full py-3 rounded-xl text-base font-semibold transition-colors ${
                      connected
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                        : 'bg-[#6C60FF] hover:bg-[#5A4FFF] text-white'
                    }`}
                  >
                    {connected ? 'Manage' : 'Get Widget'}
                  </button>
                );
              })()}
            </div>
          </div>
        ))}
      </div>

      {/* Shopify Connect Modal */}
      {activeModal === 'shopify' && (
        <ShopifyConnectModal
          onClose={() => setActiveModal(null)}
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
          onClose={() => setActiveModal(null)}
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

      {/* AutoTrader Connect Modal */}
      {activeModal === 'autotrader' && (
        <AutoTraderConnectModal onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}
