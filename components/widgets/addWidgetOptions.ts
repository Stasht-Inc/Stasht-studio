// The campaign page's "+" → "Add Widget" chooser (images/198.jpg): its options, in its order, with its words. Pure, so
// `node --test` loads it; AddWidgetChooser.tsx draws them. Chris, 8 Nov 2026 (point 1): the Storeel preview's "+"
// opens this same chooser — every option, never a narrower copy.

export const ADD_WIDGET_KINDS = ['moment', 'cta', 'request_moment', 'voice', 'html', 'youtube', 'quote', 'ai_creator', 'shopify_product', 'docusign'] as const;
export type AddWidgetKind = typeof ADD_WIDGET_KINDS[number];

export interface AddWidgetOption {
  kind: AddWidgetKind;
  label: string;
  desc: string;
}

const BASE: AddWidgetOption[] = [
  { kind: 'moment', label: 'Moment', desc: 'Add a special moment' },
  { kind: 'cta', label: 'Call to Action', desc: 'Add a button with a link' },
  { kind: 'request_moment', label: 'Share Request a Moment', desc: 'Allow photos and caption contributions' },
  { kind: 'voice', label: 'Voice to Text', desc: 'Create moment captions' },
  { kind: 'html', label: 'HTML', desc: 'Add custom HTML content' },
  { kind: 'youtube', label: 'Youtube', desc: 'Embed a YouTube link' },
  { kind: 'quote', label: 'Quote', desc: 'Add an inspirational quote' },
  { kind: 'ai_creator', label: 'AI Creator', desc: 'Generate content with AI' },
];

/**
 * The options: the desktop chooser's (Moment … AI Creator), Shopify Product when asked (the campaign page's phone "+"
 * menu has it), DocuSign only when DocuSign is connected (as on the campaign page).
 */
export function addWidgetOptions({ docuSign, shopifyProduct = false }: { docuSign: boolean; shopifyProduct?: boolean }): AddWidgetOption[] {
  return [
    ...BASE,
    ...(shopifyProduct ? [{ kind: 'shopify_product' as const, label: 'Shopify Product', desc: 'Add products from your store' }] : []),
    ...(docuSign ? [{ kind: 'docusign' as const, label: 'DocuSign', desc: 'Send for signature' }] : []),
  ];
}
