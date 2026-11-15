// components/products/layerFocus.ts — where focus goes back to when the product layers close (post-live P1).
// The details view and the editor are full-screen layers that swap with each other (details → Edit → editor → Save →
// details). What had focus when the first of them opened (a product card, Add a product) is kept across every swap
// and focused again only when the last layer closes.

const LAYERS = '[data-testid="product-editor"], [data-testid="product-details"]';
let opener: HTMLElement | null = null;

/** On a layer's mount: remember the opener, unless focus is on the page body (a swap) or inside a layer. */
export function captureOpener(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body && !active.closest(LAYERS)) opener = active;
}

/** On a layer's unmount: once no product layer is left, focus the opener again. */
export function releaseOpener(): void {
  window.setTimeout(() => {
    if (document.querySelector(LAYERS)) return; // swapped to the other layer (or remounted on another product)
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }, 0);
}
