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

// ── Chris 21 Nov 2026 (P8): the account's Settings location is Create Campaign's default Location ───────────────
// The field opens filled with the Location saved in Profile Settings (an External account's own location in the
// property view) instead of the device's city; "Use current location" fills the device's city on request. Once the
// person edits the field (types, picks, clears with ×), nothing fills it again in that sitting — clearing sticks.

/** The default Location for a new campaign: the External account's location in the property view, else the account's. */
export function defaultCampaignLocation({ viewType, propertyLocation, profileLocation }: {
  viewType: string | null | undefined;
  propertyLocation?: unknown;
  profileLocation?: unknown;
}): string {
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return viewType === 'property' ? text(propertyLocation) : text(profileLocation);
}

/** setFormData(prev => withDefaultLocation(prev, loc, opts)): the same object when nothing should change. */
export function withDefaultLocation<T extends { location?: string }>(prev: T, location: string, { saved, touched }: { saved: boolean; touched: boolean }): T {
  if (saved || touched || !location || String(prev.location ?? '').trim()) return prev;
  return { ...prev, location };
}

/** "City, Country" from a Nominatim reverse-geocode answer (the lookup Create Campaign already used). */
export function placeLabel(data: any): string {
  const a = data?.address || {};
  const city = a.city || a.town || a.village || a.county;
  const country = a.country;
  if (city && country) return `${city}, ${country}`;
  if (city) return String(city);
  if (country) return String(country);
  return String(data?.display_name || '').split(',').slice(0, 2).join(',').trim();
}
