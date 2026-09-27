// Connectors offered on the Connectors page (pages/MarketplacePage.tsx).

export type ConnectorId = 'shopify' | 'docusign' | 'autotrader' | 'contact-widget';

export interface ConnectorDef {
  id: ConnectorId;
  name: string;
  category: string;
  description: string;
  features: string[];
  bannerLogo?: string;
  iconImage?: string;
  iconFill?: boolean;
}

export const CONNECTORS: ConnectorDef[] = [
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
  {
    id: 'contact-widget',
    name: 'Contact Us Widget',
    category: 'Website Lead Capture',
    description: 'Capture leads straight from your own website with a chat-style Contact Us widget.',
    features: ['Customizable color, agent name, and greeting', 'Leads land in your Leads inbox', 'One-line install'],
  },
];

// AutoTrader hidden from the Connectors page (Deepak, 2026-09-22) — its connect modal is kept,
// just not offered.
export const OFFERED_CONNECTORS = CONNECTORS.filter((c) => c.id !== 'autotrader');

export const brandColors: Record<ConnectorId, string> = {
  shopify: 'linear-gradient(145deg, #95BF47, #5E8E3E)',
  docusign: '#ffffff',
  autotrader: '#ffffff',
  'contact-widget': 'linear-gradient(145deg, #8B80FF, #6C60FF)',
};

export const brandInitials: Partial<Record<ConnectorId, string>> = {
  shopify: 'S',
  docusign: 'D',
  autotrader: 'AT',
};

/** Name of the event the Connectors page fires so the sidebar badge updates without a reload. */
export const CONNECTORS_COUNT_EVENT = 'connectors-count-refresh';
