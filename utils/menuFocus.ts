// Row "⋯" menus (Radix DropdownMenu): where focus goes when the menu closes.
//
// Radix puts focus back on the menu's button when the menu closes. After a mouse or touch close the browser then draws
// the keyboard focus ring on that button — the purple outline Chris saw on the Newsletters and Lists rows (1 Nov
// 2026). Pass keyboardOnlyFocusReturn as the menu content's onCloseAutoFocus: focus goes back only when the last thing
// the person did was use the keyboard (Escape, Enter on an item), so keyboard users keep their place and see it.

let lastInput: 'keyboard' | 'pointer' = 'pointer';

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', () => { lastInput = 'keyboard'; }, true);
  document.addEventListener('pointerdown', () => { lastInput = 'pointer'; }, true);
}

/** DropdownMenuContent onCloseAutoFocus: keep Radix's focus return for keyboard closes only. */
export function keyboardOnlyFocusReturn(event: Event): void {
  if (lastInput === 'pointer') event.preventDefault();
}
