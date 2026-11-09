// The device's city as a default Location (Create Campaign). Review fix, 8 Nov 2026 (b): it is looked up only when
// creating — never on a saved campaign (Edit / the campaign page's Send), whose saved Location Save Changes /
// Save & Send would otherwise overwrite — and it fills only a field that is still empty when the lookup answers
// (read from the current form, not the value when the lookup started). Pure, so `node --test` loads it.

export function detectsDeviceLocation({ open, campaignId, saved, deviceLocation }: {
  open: boolean;
  /** The campaign being edited (Edit / Send), else null. */
  campaignId: number | null | undefined;
  /** A campaign already exists in this flow (Edit, or Save & Send made one). */
  saved: boolean;
  deviceLocation: string;
}): boolean {
  return Boolean(open && !campaignId && !saved && !deviceLocation);
}

/** setFormData(prev => withDeviceLocation(prev, city, saved)): the same object when nothing should change. */
export function withDeviceLocation<T extends { location?: string }>(prev: T, locationString: string, saved: boolean): T {
  if (saved || !locationString || String(prev.location ?? '').trim()) return prev;
  return { ...prev, location: locationString };
}
