// The Button section's options (Chris, 6 Nov): Full width (the button spans the section's content width) and Open in
// new window (target="_blank" on the link). Like the API (NewsletterContent::buttonOptions) each is kept only when on:
// a button saved before has neither, so it looks and opens exactly as it did. New buttons open in a new window
// (createBlock). Pure.
import type { ButtonBlockData } from '../../../services/newslettersAPI.ts';

export type ButtonOption = 'full_width' | 'new_window';
export const BUTTON_OPTIONS: readonly ButtonOption[] = ['full_width', 'new_window'];

/** The options that are on (true only; anything else is off). */
export function buttonOptionsOf(d: Record<string, unknown>): Pick<ButtonBlockData, ButtonOption> {
  const out: Pick<ButtonBlockData, ButtonOption> = {};
  for (const key of BUTTON_OPTIONS) if (d[key] === true) out[key] = true;
  return out;
}

/** The same change as an editor patch (onChange merges it): unticked is undefined, which JSON leaves out. */
export function buttonOptionPatch(key: ButtonOption, on: boolean): Partial<ButtonBlockData> {
  return { [key]: on ? true : undefined };
}
