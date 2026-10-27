import type { KeyboardEvent } from 'react';

/** ArrowUp / ArrowDown move focus between the focusable items inside a list (menus, checklists). */
export function moveFocusWithArrows(e: KeyboardEvent<HTMLElement>, selector = 'button:not([disabled]), input:not([disabled])'): void {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(selector));
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (index === -1) return;
  e.preventDefault();
  items[(index + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
}
